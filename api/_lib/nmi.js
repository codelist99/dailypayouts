import crypto from 'node:crypto';

export const OFFERS = Object.freeze({
  frontend: { name: 'Daily Payouts - FE', amount: '67.00' },
  platinum: { name: 'Daily Payouts Platinum Setup', amount: '147.00' },
  dsplatinum: { name: 'Daily Payouts Platinum Setup - Special Offer', amount: '97.00' },
  rapid: { name: 'Rapid Daily Payouts', amount: '97.00' },
  dsrapid: { name: 'Rapid Daily Payouts - Special Offer', amount: '77.00' },
  multiplier: { name: 'Daily Payouts Multiplier', amount: '77.00' },
  dsmultiplier: { name: 'Daily Payouts Multiplier - Special Offer', amount: '57.00' },
  protector: { name: 'Daily Payouts Protector', amount: '47.00' },
  dsprotector: { name: 'Daily Payouts Protector - Special Offer', amount: '37.00' },
  social: { name: 'Social Payments Bot', amount: '37.00' },
  dssocial: { name: 'Social Payments Bot - Special Offer', amount: '27.00' }
});

const NMI_ENDPOINT = 'https://secure.nmi.com/api/transact.php';

export function json(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function requirePost(req, res) {
  if (req.method === 'POST') return true;
  res.setHeader('Allow', 'POST');
  json(res, 405, { success: false, message: 'Method not allowed.' });
  return false;
}

export async function transact(fields, fetcher = fetch) {
  const securityKey = process.env.NMI_PRIVATE_KEY;
  if (!securityKey) throw new Error('NMI_PRIVATE_KEY is not configured.');
  const testMode = process.env.NMI_TEST_MODE === 'enabled' ? { test_mode: 'enabled' } : {};
  const body = new URLSearchParams({ security_key: securityKey, ...testMode, ...fields });
  const response = await fetcher(NMI_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`NMI returned HTTP ${response.status}.`);
  const parsed = Object.fromEntries(new URLSearchParams(await response.text()));
  return {
    approved: parsed.response === '1',
    message: parsed.responsetext || 'The transaction could not be processed.',
    transactionId: parsed.transactionid || '',
    vaultId: parsed.customer_vault_id || '',
    responseCode: parsed.response_code || '',
    raw: parsed
  };
}

function signingKey() {
  const source = process.env.CHECKOUT_SESSION_SECRET || process.env.NMI_PRIVATE_KEY;
  if (!source) throw new Error('Checkout session signing key is not configured.');
  return crypto.createHash('sha256').update(`daily-payouts:${source}`).digest();
}

function signature(value) {
  return crypto.createHmac('sha256', signingKey()).update(value).digest('base64url');
}

export function createSessionCookie(payload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const value = `${encoded}.${signature(encoded)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `dp_checkout=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400${secure}`;
}

export function readSession(req) {
  const cookie = (req.headers.cookie || '').split(';').map(item => item.trim()).find(item => item.startsWith('dp_checkout='));
  if (!cookie) return null;
  const value = cookie.slice('dp_checkout='.length);
  const [encoded, suppliedSignature] = value.split('.');
  if (!encoded || !suppliedSignature) return null;
  const expected = signature(encoded);
  const suppliedBuffer = Buffer.from(suppliedSignature);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString());
    if (!payload.vaultId || !payload.expires || payload.expires < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function cleanCustomer(input = {}) {
  const text = (value, max = 100) => String(value || '').trim().slice(0, max);
  return {
    firstName: text(input.firstName, 50), lastName: text(input.lastName, 50),
    email: text(input.email, 120), phone: text(input.phone, 30),
    address1: text(input.address1, 100), city: text(input.city, 60),
    state: text(input.state, 40), zip: text(input.zip, 20), country: text(input.country, 2).toUpperCase() || 'US'
  };
}

export function orderId(prefix) {
  return `DP-${prefix.toUpperCase()}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`.slice(0, 64);
}
