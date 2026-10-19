import { ensureSchema, sql } from './_lib/analytics.js';

const csv = (rows, columns) => {
  const q = value => `"${String(value ?? '').replaceAll('"', '""')}"`;
  return [columns.map(c => q(c.label)).join(','), ...rows.map(row => columns.map(c => q(row[c.key])).join(','))].join('\n');
};

export default async function handler(req, res) {
  try {
    await ensureSchema();
    const db = sql();
    const action = String(req.query.action || 'dashboard');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, Number(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const search = `%${String(req.query.search || '').slice(0, 100)}%`;

    if (action === 'logistics') {
      const parsedStart = new Date(String(req.query.start || ''));
      const parsedEnd = new Date(String(req.query.end || ''));
      const end = Number.isNaN(parsedEnd.getTime()) ? new Date() : parsedEnd;
      const start = Number.isNaN(parsedStart.getTime()) ? new Date(end.getTime() - 86400000) : parsedStart;
      const startIso = start.toISOString(), endIso = end.toISOString();
      const [events, commerce, trend, payments, offers, attribution, routes, devices] = await Promise.all([
        db`SELECT
          COUNT(*) FILTER(WHERE event_type='page_view')::int views,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='page_view')::int visitors,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='video_unmuted')::int video_engaged,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='cta_click')::int cta_clicks,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='page_view' AND path='/checkout')::int checkout_visitors,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='checkout_started')::int checkout_started,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='lead_captured')::int captured,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='video_progress' AND metadata->>'percent'='25')::int video_25,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='video_progress' AND metadata->>'percent'='50')::int video_50,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='video_progress' AND metadata->>'percent'='75')::int video_75,
          COUNT(DISTINCT session_id) FILTER(WHERE event_type='video_progress' AND metadata->>'percent'='100')::int video_100
          FROM dp_events WHERE created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz`,
        db`SELECT COUNT(*)::int attempts, COUNT(*) FILTER(WHERE status='paid')::int approvals,
          COUNT(*) FILTER(WHERE status='declined')::int declines, COUNT(*) FILTER(WHERE status='error')::int errors,
          COUNT(DISTINCT lead_id) FILTER(WHERE status='paid')::int buyers,
          COUNT(DISTINCT lead_id)::int payment_people,
          COALESCE(SUM(amount) FILTER(WHERE status='paid'),0)::numeric revenue,
          COALESCE(SUM(amount) FILTER(WHERE status='refunded'),0)::numeric refunds,
          COUNT(DISTINCT lead_id) FILTER(WHERE status='declined')::int declined_people,
          COUNT(*) FILTER(WHERE status='declined')::int declined_attempts
          FROM dp_orders WHERE created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz`,
        db`SELECT date_trunc('hour', bucket) bucket,
          SUM(views)::int views, SUM(leads)::int leads, SUM(buyers)::int buyers, SUM(revenue)::numeric revenue
          FROM (
            SELECT created_at bucket, 1 views, 0 leads, 0 buyers, 0 revenue FROM dp_events WHERE event_type='page_view' AND created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
            UNION ALL SELECT created_at, 0, 1, 0, 0 FROM dp_leads WHERE created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
            UNION ALL SELECT created_at, 0, 0, 1, amount FROM dp_orders WHERE status='paid' AND created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
          ) x GROUP BY 1 ORDER BY 1`,
        db`SELECT COALESCE(response_code,'—') response_code, COALESCE(NULLIF(gateway_response,''),'No response') response,
          status, COUNT(*)::int attempts, COUNT(DISTINCT lead_id)::int people, COALESCE(SUM(amount),0)::numeric amount
          FROM dp_orders WHERE created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
          GROUP BY 1,2,3 ORDER BY attempts DESC`,
        db`SELECT offer_key, product_name, COUNT(*)::int attempts,
          COUNT(*) FILTER(WHERE status='paid')::int approvals, COUNT(*) FILTER(WHERE status='declined')::int declines,
          COUNT(DISTINCT lead_id)::int people, COALESCE(SUM(amount) FILTER(WHERE status='paid'),0)::numeric revenue,
          COALESCE(AVG(amount),0)::numeric price
          FROM dp_orders WHERE created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
          GROUP BY offer_key,product_name ORDER BY MIN(created_at)`,
        db`SELECT COALESCE(NULLIF(source,''),'direct') source, COALESCE(NULLIF(campaign,''),'—') campaign,
          COUNT(*)::int leads, COUNT(*) FILTER(WHERE status='buyer')::int buyers
          FROM dp_leads WHERE created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
          GROUP BY 1,2 ORDER BY leads DESC`,
        db`SELECT path, COUNT(*)::int views, COUNT(DISTINCT session_id)::int visitors
          FROM dp_events WHERE event_type='page_view' AND created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
          GROUP BY path ORDER BY views DESC`,
        db`SELECT COALESCE(metadata->>'device','unknown') device, COUNT(DISTINCT session_id)::int visitors
          FROM dp_events WHERE event_type='page_view' AND created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz
          GROUP BY 1 ORDER BY visitors DESC`
      ]);
      const e = events[0], c = commerce[0];
      const num = value => Number(value || 0);
      const summary = { ...e, ...c, revenue: num(c.revenue), refunds: num(c.refunds) };
      summary.net_revenue = summary.revenue - summary.refunds;
      summary.leads = (await db`SELECT COUNT(*)::int count FROM dp_leads WHERE created_at>=${startIso}::timestamptz AND created_at<${endIso}::timestamptz`)[0].count;
      summary.conversion = summary.visitors ? +(summary.buyers / summary.visitors * 100).toFixed(2) : 0;
      summary.lead_conversion = summary.leads ? +(summary.buyers / summary.leads * 100).toFixed(2) : 0;
      summary.approval_rate = summary.attempts ? +(summary.approvals / summary.attempts * 100).toFixed(1) : 0;
      summary.rpv = summary.visitors ? +(summary.revenue / summary.visitors).toFixed(2) : 0;
      summary.rpl = summary.leads ? +(summary.revenue / summary.leads).toFixed(2) : 0;
      summary.aov = summary.buyers ? +(summary.revenue / summary.buyers).toFixed(2) : 0;
      return res.status(200).json({ range: { start: startIso, end: endIso }, summary, trend, payments, offers, attribution, routes, devices });
    }

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
