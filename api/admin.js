import { ensureSchema, requireAdmin, sql } from './_lib/analytics.js';

const csv = (rows, columns) => {
  const q = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.map(c => q(c.label)).join(','), ...rows.map(row => columns.map(c => q(row[c.key])).join(','))].join('\n');
};

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    await ensureSchema();
    const db = sql();
    const action = String(req.query.action || 'dashboard');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const search = `%${String(req.query.search || '').slice(0, 100)}%`;

    if (action === 'dashboard') {
      const [summary] = await db`SELECT
        (SELECT COUNT(*)::int FROM dp_leads) AS leads,
        (SELECT COUNT(DISTINCT lead_id)::int FROM dp_orders WHERE status='paid') AS buyers,
        (SELECT COALESCE(SUM(amount),0)::numeric FROM dp_orders WHERE status='paid') AS revenue,
        (SELECT COUNT(*)::int FROM dp_orders) AS attempts,
        (SELECT COUNT(*)::int FROM dp_orders WHERE status='declined') AS declined,
        (SELECT COUNT(*)::int FROM dp_orders WHERE status='error') AS errors,
        (SELECT COUNT(*)::int FROM dp_events WHERE event_type='page_view') AS page_views`;
      summary.conversion = summary.leads ? Number((summary.buyers / summary.leads * 100).toFixed(1)) : 0;
      return res.status(200).json(summary);
    }
    if (action === 'orders') {
      const rows = await db`SELECT o.*, CONCAT_WS(' ', l.first_name, l.last_name) AS name, l.email, l.phone
        FROM dp_orders o LEFT JOIN dp_leads l ON l.id=o.lead_id ORDER BY o.updated_at DESC LIMIT ${limit} OFFSET ${offset}`;
      const [{ count }] = await db`SELECT COUNT(*)::int count FROM dp_orders`;
      return res.status(200).json({ rows, count, page, limit });
    }
    if (action === 'leads' || action === 'leads-export') {
      const rows = await db`SELECT *, CONCAT_WS(' ', first_name, last_name) AS name FROM dp_leads
        WHERE email ILIKE ${search} OR first_name ILIKE ${search} OR last_name ILIKE ${search} OR phone ILIKE ${search}
        ORDER BY created_at DESC LIMIT ${action.endsWith('export') ? 10000 : limit} OFFSET ${action.endsWith('export') ? 0 : offset}`;
      if (action.endsWith('export')) {
        res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="daily-payouts-leads.csv"');
        return res.status(200).send(csv(rows, [{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'status',label:'Status'},{key:'source',label:'Source'},{key:'campaign',label:'Campaign'},{key:'landing_page',label:'Landing Page'},{key:'created_at',label:'Created'}]));
      }
      const [{ count }] = await db`SELECT COUNT(*)::int count FROM dp_leads WHERE email ILIKE ${search} OR first_name ILIKE ${search} OR last_name ILIKE ${search} OR phone ILIKE ${search}`;
      return res.status(200).json({ rows, count, page, limit });
    }
    if (action === 'sales' || action === 'sales-export') {
      const rows = await db`SELECT l.id, CONCAT_WS(' ', l.first_name, l.last_name) AS name, l.email, l.phone,
        COUNT(*) FILTER (WHERE o.status='paid')::int AS purchases,
        STRING_AGG(o.product_name, ', ' ORDER BY o.created_at) FILTER (WHERE o.status='paid') AS products,
        COALESCE(SUM(o.amount) FILTER (WHERE o.status='paid'),0)::numeric AS gross,
        COALESCE(SUM(o.amount) FILTER (WHERE o.status='refunded'),0)::numeric AS refunds,
        COALESCE(SUM(o.amount) FILTER (WHERE o.status='paid'),0) - COALESCE(SUM(o.amount) FILTER (WHERE o.status='refunded'),0) AS net,
        MAX(o.updated_at) FILTER (WHERE o.status='paid') AS last_purchase
        FROM dp_leads l JOIN dp_orders o ON o.lead_id=l.id
        WHERE l.email ILIKE ${search} OR l.first_name ILIKE ${search} OR l.last_name ILIKE ${search} OR l.phone ILIKE ${search}
        GROUP BY l.id HAVING COUNT(*) FILTER (WHERE o.status IN ('paid','refunded')) > 0
        ORDER BY last_purchase DESC NULLS LAST LIMIT ${action.endsWith('export') ? 10000 : limit} OFFSET ${action.endsWith('export') ? 0 : offset}`;
      if (action.endsWith('export')) {
        res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="daily-payouts-sales.csv"');
        return res.status(200).send(csv(rows, [{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'purchases',label:'Purchases'},{key:'products',label:'Products'},{key:'gross',label:'Gross'},{key:'refunds',label:'Refunds'},{key:'net',label:'Net'},{key:'last_purchase',label:'Last Purchase'}]));
      }
      return res.status(200).json({ rows, count: rows.length, page, limit });
    }
    return res.status(404).json({ message: 'Unknown report.' });
  } catch (error) {
    console.error('Admin API error:', error.message);
    return res.status(500).json({ message: 'Unable to load analytics.' });
  }
}
