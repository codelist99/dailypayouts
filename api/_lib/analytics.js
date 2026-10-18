import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';

let initialized;
const sql = () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  return neon(process.env.DATABASE_URL);
};

export async function ensureSchema() {
  if (!initialized) initialized = (async () => {
    const db = sql();
    await db`CREATE TABLE IF NOT EXISTS dp_leads (
      id UUID PRIMARY KEY, session_id TEXT UNIQUE NOT NULL, first_name TEXT, last_name TEXT,
      email TEXT, phone TEXT, source TEXT, campaign TEXT, landing_page TEXT,
      consent BOOLEAN DEFAULT FALSE, status TEXT DEFAULT 'lead', metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await db`CREATE TABLE IF NOT EXISTS dp_orders (
      id UUID PRIMARY KEY, lead_id UUID REFERENCES dp_leads(id), session_id TEXT, offer_key TEXT NOT NULL,
      product_name TEXT NOT NULL, amount NUMERIC(10,2) NOT NULL, status TEXT NOT NULL,
      transaction_id TEXT, response_code TEXT, gateway_response TEXT, metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await db`CREATE TABLE IF NOT EXISTS dp_events (
      id BIGSERIAL PRIMARY KEY, session_id TEXT, lead_id UUID, event_type TEXT NOT NULL,
      path TEXT, offer_key TEXT, metadata JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await db`CREATE INDEX IF NOT EXISTS dp_orders_lead_idx ON dp_orders(lead_id)`;
    await db`CREATE INDEX IF NOT EXISTS dp_orders_created_idx ON dp_orders(created_at DESC)`;
    await db`CREATE INDEX IF NOT EXISTS dp_events_created_idx ON dp_events(created_at DESC)`;
  })().catch(error => { initialized = undefined; throw error; });
  return initialized;
}

export const newId = () => crypto.randomUUID();

export async function upsertLead({ sessionId, customer = {}, tracking = {} }) {
  if (process.env.ANALYTICS_DISABLED === 'true') return newId();
  await ensureSchema();
  const db = sql();
  const id = newId();
  const rows = await db`INSERT INTO dp_leads
    (id, session_id, first_name, last_name, email, phone, source, campaign, landing_page, consent, metadata)
    VALUES (${id}, ${sessionId}, ${customer.firstName || ''}, ${customer.lastName || ''}, ${customer.email || ''},
      ${customer.phone || ''}, ${tracking.source || 'direct'}, ${tracking.campaign || ''}, ${tracking.landingPage || ''},
      ${Boolean(tracking.consent)}, ${JSON.stringify(tracking)})
    ON CONFLICT (session_id) DO UPDATE SET
      first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), dp_leads.first_name),
      last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), dp_leads.last_name),
      email = COALESCE(NULLIF(EXCLUDED.email, ''), dp_leads.email),
      phone = COALESCE(NULLIF(EXCLUDED.phone, ''), dp_leads.phone),
      source = COALESCE(NULLIF(EXCLUDED.source, ''), dp_leads.source),
      campaign = COALESCE(NULLIF(EXCLUDED.campaign, ''), dp_leads.campaign),
      landing_page = COALESCE(NULLIF(EXCLUDED.landing_page, ''), dp_leads.landing_page),
      metadata = dp_leads.metadata || EXCLUDED.metadata, updated_at = NOW()
    RETURNING id`;
  return rows[0].id;
}

export async function createOrder({ leadId, sessionId, offerKey, name, amount }) {
  if (process.env.ANALYTICS_DISABLED === 'true') return newId();
  await ensureSchema();
  const id = newId();
  await sql()`INSERT INTO dp_orders (id, lead_id, session_id, offer_key, product_name, amount, status)
    VALUES (${id}, ${leadId || null}, ${sessionId || ''}, ${offerKey}, ${name}, ${amount}, 'attempted')`;
  return id;
}

export async function updateOrder(id, status, result = {}) {
  if (process.env.ANALYTICS_DISABLED === 'true') return;
  await ensureSchema();
  await sql()`UPDATE dp_orders SET status=${status}, transaction_id=${result.transactionId || ''},
    response_code=${result.responseCode || ''}, gateway_response=${result.message || ''}, updated_at=NOW() WHERE id=${id}`;
  if (status === 'paid') await sql()`UPDATE dp_leads SET status='buyer', updated_at=NOW() WHERE id=(SELECT lead_id FROM dp_orders WHERE id=${id})`;
}

export async function recordEvent({ sessionId, leadId = null, eventType, path = '', offerKey = '', metadata = {} }) {
  if (process.env.ANALYTICS_DISABLED === 'true') return;
  await ensureSchema();
  await sql()`INSERT INTO dp_events (session_id, lead_id, event_type, path, offer_key, metadata)
    VALUES (${sessionId || ''}, ${leadId}, ${eventType}, ${path}, ${offerKey}, ${JSON.stringify(metadata)})`;
}

export function requireAdmin(req, res) {
  const expectedUser = process.env.ADMIN_USER || 'admin';
  const expectedPass = process.env.ADMIN_PASSWORD;
  const auth = String(req.headers.authorization || '');
  let supplied = ['', ''];
  if (auth.startsWith('Basic ')) {
    try { supplied = Buffer.from(auth.slice(6), 'base64').toString().split(':'); } catch {}
  }
  const safe = (a, b) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  if (!expectedPass || !safe(supplied[0] || '', expectedUser) || !safe(supplied.slice(1).join(':') || '', expectedPass)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Daily Payouts Admin"');
    res.status(401).end('Authentication required');
    return false;
  }
  return true;
}

export { sql };
