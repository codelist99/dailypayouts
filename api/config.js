import { json, OFFERS } from './_lib/nmi.js';

export default function handler(req, res) {
  if (req.method !== 'GET') return json(res, 405, { message: 'Method not allowed.' });
  const tokenizationKey = process.env.NMI_TOKENIZATION_KEY;
  if (!tokenizationKey) return json(res, 503, { message: 'Payment gateway is not configured.' });
  res.setHeader('Cache-Control', 'no-store');
  return json(res, 200, {
    tokenizationKey,
    oneDollarTestMode: process.env.ONE_DOLLAR_TEST_MODE === 'true',
    prices: Object.fromEntries(Object.entries(OFFERS).map(([key, offer]) => [key, offer.amount]))
  });
}
