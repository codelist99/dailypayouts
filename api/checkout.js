import { OFFERS, cleanCustomer, createSessionCookie, json, orderId, requirePost, transact } from './_lib/nmi.js';
import { createOrder, updateOrder, upsertLead } from './_lib/analytics.js';

export default async function handler(req, res) {
  if (!requirePost(req, res)) return;
  try {
    const paymentToken = String(req.body?.paymentToken || '').trim();
    const customer = cleanCustomer(req.body?.customer);
    const sessionId = String(req.body?.sessionId || '').slice(0, 100);
    const tracking = req.body?.tracking || {};
    if (!paymentToken || !customer.firstName || !customer.lastName || !customer.email || !customer.address1 || !customer.city || !customer.state || !customer.zip) {
      return json(res, 400, { success: false, message: 'Please complete all required billing and payment fields.' });
    }
    const offer = OFFERS.frontend;
    const leadId = await upsertLead({ sessionId, customer, tracking });
    const analyticsOrderId = await createOrder({ leadId, sessionId, offerKey: 'frontend', name: offer.name, amount: offer.amount });
    let result;
    try { result = await transact({
      type: 'sale', payment_token: paymentToken, amount: offer.amount,
      orderid: orderId('frontend'), order_description: offer.name,
      firstname: customer.firstName, lastname: customer.lastName,
      email: customer.email, phone: customer.phone, address1: customer.address1,
      city: customer.city, state: customer.state, zip: customer.zip, country: customer.country,
      customer_vault: 'add_customer', customer_receipt: 'true',
      initiated_by: 'customer', stored_credential_indicator: 'stored'
    }); } catch (error) {
      await updateOrder(analyticsOrderId, 'error', { message: error.message });
      throw error;
    }
    if (!result.approved) {
      await updateOrder(analyticsOrderId, 'declined', result);
      return json(res, 402, { success: false, message: result.message, code: result.responseCode });
    }
    await updateOrder(analyticsOrderId, 'paid', result);
    if (!result.vaultId) return json(res, 502, { success: false, message: 'Payment approved, but the saved payment profile was not returned. Please contact support.', transactionId: result.transactionId });
    const session = {
      vaultId: result.vaultId, email: customer.email, leadId, sessionId,
      purchased: ['frontend'], transactionIds: { frontend: result.transactionId },
      expires: Date.now() + 86400000
    };
    res.setHeader('Set-Cookie', createSessionCookie(session));
    return json(res, 200, { success: true, transactionId: result.transactionId, next: '/platinum' });
  } catch (error) {
    console.error('Checkout error:', error.message);
    return json(res, 500, { success: false, message: 'The payment service is temporarily unavailable. Please try again.' });
  }
}
