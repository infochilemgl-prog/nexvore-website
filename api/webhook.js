'use strict';

/**
 * Vercel Serverless Function — MercadoPago IPN Webhook
 *
 * Handles two notification formats:
 *   1. POST body: { type: "payment", data: { id: "..." } }
 *   2. Query params: ?topic=payment&id=...
 *
 * Flow:
 *   - Extract payment ID from whichever format arrives
 *   - Verify payment via MercadoPago API
 *   - If status === 'approved', send resource delivery email via Resend
 *   - Always return 200 quickly to prevent MercadoPago retries
 */

const { sendRecursosEmail } = require('../lib/resend');

const MP_API_BASE = 'https://api.mercadopago.com/v1';

/**
 * Fetch payment details from the MercadoPago API.
 *
 * @param {string|number} paymentId
 * @returns {Promise<object>} Payment object from MP API
 */
async function getPayment(paymentId) {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) {
    throw new Error('MP_ACCESS_TOKEN env var is not set');
  }

  const url = `${MP_API_BASE}/payments/${paymentId}`;
  console.log(`[webhook] Fetching payment from MP API: ${url}`);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`MP API responded ${response.status}: ${text}`);
  }

  return response.json();
}

/**
 * Extract the payment ID from either notification format.
 *
 * @param {object} body   - Parsed request body (may be null)
 * @param {object} query  - Parsed query string params
 * @returns {string|null} Payment ID string, or null if not found
 */
function extractPaymentId(body, query) {
  // Format 1: POST body { type: "payment", data: { id: "..." } }
  if (body && body.type === 'payment' && body.data && body.data.id) {
    return String(body.data.id);
  }

  // Format 2: ?topic=payment&id=...
  if (query && query.topic === 'payment' && query.id) {
    return String(query.id);
  }

  // Fallback: some integrations send { action: "payment.updated", data: { id } }
  if (body && body.data && body.data.id) {
    return String(body.data.id);
  }

  return null;
}

/**
 * Parse raw body buffer as JSON, returning null on failure.
 *
 * @param {Buffer|string} raw
 * @returns {object|null}
 */
function safeParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/**
 * Main Vercel handler.
 */
module.exports = async function handler(req, res) {
  // Respond immediately to non-POST requests (health check / GET from browser)
  if (req.method !== 'POST') {
    return res.status(200).json({ ok: true, message: 'Nexvore webhook endpoint is live.' });
  }

  console.log('[webhook] Incoming POST —', new Date().toISOString());
  console.log('[webhook] Query:', JSON.stringify(req.query));

  // Vercel parses JSON bodies automatically when Content-Type is application/json.
  // Fall back to raw parsing just in case.
  const body = typeof req.body === 'object' && req.body !== null
    ? req.body
    : safeParseJson(req.body);

  console.log('[webhook] Body:', JSON.stringify(body));

  const paymentId = extractPaymentId(body, req.query);

  if (!paymentId) {
    console.warn('[webhook] Could not extract payment ID — ignoring notification');
    // Still return 200 so MercadoPago doesn't keep retrying
    return res.status(200).json({ ok: true, message: 'No payment ID found; ignoring.' });
  }

  console.log(`[webhook] Payment ID: ${paymentId}`);

  let payment;
  try {
    payment = await getPayment(paymentId);
  } catch (err) {
    console.error('[webhook] Failed to fetch payment from MP API:', err.message);
    // Return 200 anyway — we don't want MP to flood us with retries for a temporary error.
    // You can change this to 500 if you prefer retries on API errors.
    return res.status(200).json({ ok: false, error: 'Could not verify payment.' });
  }

  console.log(`[webhook] Payment status: ${payment.status}, email: ${payment.payer && payment.payer.email}`);

  if (payment.status !== 'approved') {
    console.log(`[webhook] Payment ${paymentId} is not approved (status=${payment.status}). No email sent.`);
    return res.status(200).json({ ok: true, message: `Payment status is '${payment.status}'; no action taken.` });
  }

  // Extract buyer info from payment object
  const toEmail = payment.payer && payment.payer.email;
  const firstName =
    (payment.payer && payment.payer.first_name) ||
    (payment.additional_info && payment.additional_info.payer && payment.additional_info.payer.first_name) ||
    'Cliente';

  if (!toEmail) {
    console.error('[webhook] Approved payment but no payer email found. Payment ID:', paymentId);
    return res.status(200).json({ ok: false, error: 'No payer email in payment object.' });
  }

  try {
    await sendRecursosEmail(toEmail, firstName);
    console.log(`[webhook] Resources email delivered to ${toEmail} for payment ${paymentId}`);
  } catch (err) {
    console.error('[webhook] Failed to send email:', err.message);
    // Return 200 so MP doesn't retry — you may want alerting here instead
    return res.status(200).json({ ok: false, error: 'Email delivery failed.' });
  }

  return res.status(200).json({ ok: true, message: 'Payment approved and email sent.' });
};
