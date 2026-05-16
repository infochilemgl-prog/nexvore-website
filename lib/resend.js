'use strict';

const { Resend } = require('resend');
const emailTemplate = require('./email-template');

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send the Nexvore resources delivery email.
 *
 * @param {string} toEmail    - Recipient email address
 * @param {string} firstName  - Recipient's first name (used in subject + body)
 * @returns {Promise<object>} - Resend API response data
 */
async function sendRecursosEmail(toEmail, firstName) {
  const subject = `✅ Tu acceso a Nexvore está listo, ${firstName}`;
  const html = emailTemplate(firstName);

  console.log(`[resend] Sending recursos email to ${toEmail} (firstName=${firstName})`);

  const { data, error } = await resend.emails.send({
    from: 'no-reply@nex-vore.com',
    to: toEmail,
    subject,
    html,
  });

  if (error) {
    console.error('[resend] Error sending email:', error);
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  console.log(`[resend] Email sent successfully. ID: ${data && data.id}`);
  return data;
}

module.exports = { sendRecursosEmail };
