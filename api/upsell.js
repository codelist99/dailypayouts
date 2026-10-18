import { OFFERS, createSessionCookie, json, orderId, readSession, requirePost, transact } from './_lib/nmi.js';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const offerKey = String(req.body?.offer || '');
    const offer = OFFERS[offerKey];
    if (!offer || offerKey === 'frontend') return json(res, 400, { success: false, message: 'Invalid offer.' });
    const session = readSession(req);
    if (!session) return json(res, 401, { success: false, message: 'Your checkout session expired. Please return to checkout.', checkoutRequired: true });
    if (session.purchased?.includes(offerKey)) {
      return json(res, 200, { success: true, duplicate: true, transactionId: session.transactionIds?.[offerKey] || '' });
    }
    const result = await transact({
      type: 'sale', customer_vault_id: session.vaultId, amount: offer.amount,
      orderid: orderId(offerKey), order_description: offer.name,
      email: session.email || '', customer_receipt: 'true',
      initiated_by: 'customer', stored_credential_indicator: 'used',
      initial_transaction_id: session.transactionIds?.frontend || ''
    });
    if (!result.approved) return json(res, 402, { success: false, message: result.message, code: result.responseCode });
    session.purchased = [...(session.purchased || []), offerKey];
    session.transactionIds = { ...(session.transactionIds || {}), [offerKey]: result.transactionId };
    session.expires = Date.now() + 86400000;
    res.setHeader('Set-Cookie', createSessionCookie(session));
    return json(res, 200, { success: true, transactionId: result.transactionId });
  } catch (error) {
    console.error('Upsell error:', error.message);
    return json(res, 500, { success: false, message: 'The payment service is temporarily unavailable. Please try again.' });
  }
}
