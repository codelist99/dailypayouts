import assert from 'node:assert/strict';
import test from 'node:test';
import checkout from '../api/checkout.js';
import upsell from '../api/upsell.js';
import { OFFERS, readSession, transact } from '../api/_lib/nmi.js';

process.env.NMI_PRIVATE_KEY = 'test-private-key';
process.env.CHECKOUT_SESSION_SECRET = 'test-session-secret';
process.env.ANALYTICS_DISABLED = 'true';

function response() {
  return {
    statusCode: 200, headers: {}, body: '',
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; }
  };
}

function approvedFetch(vaultId = 'vault-123', transactionId = 'txn-123') {
  return async (_url, options) => {
    const submitted = Object.fromEntries(options.body);
    approvedFetch.lastSubmission = submitted;
    return new Response(new URLSearchParams({ response: '1', responsetext: 'APPROVED', transactionid: transactionId, customer_vault_id: vaultId }).toString());
  };
}

test('server-side catalog contains the verified funnel prices', () => {
  assert.deepEqual(Object.fromEntries(Object.entries(OFFERS).map(([key, offer]) => [key, offer.amount])), {
    frontend: '67.00', platinum: '147.00', dsplatinum: '97.00', rapid: '97.00', dsrapid: '77.00',
    multiplier: '77.00', dsmultiplier: '57.00', protector: '47.00', dsprotector: '37.00', social: '37.00', dssocial: '27.00'
  });
});

test('NMI transaction encoder sends form data and parses approval', async () => {
  const result = await transact({ type: 'sale', amount: '67.00', payment_token: 'one-time-token' }, approvedFetch());
  assert.equal(result.approved, true);
  assert.equal(approvedFetch.lastSubmission.security_key, 'test-private-key');
  assert.equal(approvedFetch.lastSubmission.amount, '67.00');
});

test('transaction-level test mode is included only when explicitly enabled', async () => {
  process.env.NMI_TEST_MODE = 'enabled';
  await transact({ type: 'sale', amount: '67.00', payment_token: 'one-time-token' }, approvedFetch());
  assert.equal(approvedFetch.lastSubmission.test_mode, 'enabled');
  delete process.env.NMI_TEST_MODE;
});

test('checkout charges fixed FE price, vaults card and creates signed session', async () => {
  const originalFetch = global.fetch;
  global.fetch = approvedFetch();
  const req = { method: 'POST', headers: {}, body: { paymentToken: 'token-1', customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', address1: '1 Main St', city: 'Chicago', state: 'IL', zip: '60601', country: 'US' } } };
  const res = response();
  await checkout(req, res);
  global.fetch = originalFetch;
  assert.equal(res.statusCode, 200);
  assert.equal(approvedFetch.lastSubmission.amount, '67.00');
  assert.equal(approvedFetch.lastSubmission.customer_vault, 'add_customer');
  assert.match(res.headers['set-cookie'], /HttpOnly/);
  const cookieValue = res.headers['set-cookie'].split(';')[0];
  const session = readSession({ headers: { cookie: cookieValue } });
  assert.equal(session.vaultId, 'vault-123');
  assert.deepEqual(session.purchased, ['frontend']);
});

test('one-click upsell charges saved vault at server-side price', async () => {
  const originalFetch = global.fetch;
  global.fetch = approvedFetch('vault-123', 'txn-platinum');
  const checkoutReq = { method: 'POST', headers: {}, body: { paymentToken: 'token-1', customer: { firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', address1: '1 Main St', city: 'Chicago', state: 'IL', zip: '60601' } } };
  const checkoutRes = response();
  await checkout(checkoutReq, checkoutRes);
  const cookie = checkoutRes.headers['set-cookie'].split(';')[0];
  global.fetch = approvedFetch('', 'txn-upgrade');
  const req = { method: 'POST', headers: { cookie }, body: { offer: 'dsmultiplier', amount: '0.01' } };
  const res = response();
  await upsell(req, res);
  global.fetch = originalFetch;
  assert.equal(res.statusCode, 200);
  assert.equal(approvedFetch.lastSubmission.amount, '57.00');
  assert.equal(approvedFetch.lastSubmission.customer_vault_id, 'vault-123');
  assert.equal(approvedFetch.lastSubmission.stored_credential_indicator, 'used');
  assert.equal(approvedFetch.lastSubmission.initiated_by, 'customer');
  assert.equal(approvedFetch.lastSubmission.initial_transaction_id, 'txn-platinum');
  assert.equal(approvedFetch.lastSubmission.dup_seconds, '0');
});

test('upsell rejects requests without a signed checkout session', async () => {
  const req = { method: 'POST', headers: {}, body: { offer: 'rapid' } };
  const res = response();
  await upsell(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(JSON.parse(res.body).checkoutRequired, true);
});
