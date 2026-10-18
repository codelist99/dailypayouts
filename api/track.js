import { recordEvent, upsertLead } from './_lib/analytics.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ success: false });
  try {
    const body = req.body || {};
    const sessionId = String(body.sessionId || '').slice(0, 100);
    const allowed = ['page_view', 'checkout_started', 'lead_captured', 'video_unmuted', 'offer_accepted', 'offer_declined'];
    if (!sessionId || !allowed.includes(body.eventType)) return res.status(400).json({ success: false });
    let leadId = null;
    if (body.eventType === 'lead_captured') leadId = await upsertLead({ sessionId, customer: body.customer, tracking: body.tracking });
    await recordEvent({ sessionId, leadId, eventType: body.eventType, path: String(body.path || '').slice(0, 300), offerKey: String(body.offerKey || '').slice(0, 50), metadata: body.metadata || {} });
    res.status(200).json({ success: true, leadId });
  } catch (error) {
    console.error('Tracking error:', error.message);
    res.status(500).json({ success: false });
  }
}
