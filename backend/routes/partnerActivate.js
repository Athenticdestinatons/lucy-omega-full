const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const SENDPULSE_API_KEY = process.env.SENDPULSE_API_KEY;
const SENDER_EMAIL = 'lucy@purenexus.online';
const SENDER_NAME = 'Lucy Ω';

async function sendEmail(toName, toEmail, subject, text) {
  await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SENDPULSE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: { text, subject, from: { name: SENDER_NAME, email: SENDER_EMAIL }, to: [{ name: toName, email: toEmail }] } })
  });
}

router.get('/activate', async (req, res) => {
  const { email, username, name } = req.query;
  if (!email || !username) return res.status(400).send('Missing email or username.');
  const partnerName = name || username;

  await sendEmail(partnerName, email, 'Your Lucy Ω Partner Account is Active – Download Your Plugin',
    `Hi ${partnerName},\n\nYour free partner account is live. Download the plugin:\nhttps://experience-lucy.online/lucy-affiliate-plugin.zip\n\nInstall, then go to Settings → Lucy Ω Widgets and enter your username: ${username}\n\nReferral link: https://experience-lucy.online/partner/${username}\n\n— Lucy Ω Team`);
  await sendEmail(partnerName, email, `Quick tips to earn your first commission, ${partnerName}`,
    `Hi ${partnerName},\n\nAdd the widgets to your Tools/Resources page, or email your list:\n\nSubject: The AI tool I’m using for leads\n\nHi [Name],\n\nI partnered with Lucy Ω. Try the free widget: https://experience-lucy.online/partner/${username}\n\n— Lucy Ω`);
  await sendEmail(partnerName, email, `Scaling your commissions + advanced features, ${partnerName}`,
    `Hi ${partnerName},\n\nPromote Scale ($199) – you earn $49.75/month per user.\n\nYour referral: https://experience-lucy.online/partner/${username}\n\n— Lucy Ω`);

  res.send(`<html><head><title>Partner Activated</title><style>body{font-family:sans-serif;text-align:center;padding:40px;}</style></head><body><h1>🎉 You're All Set, ${partnerName}!</h1><p>Your widgets are ready. <a href="https://experience-lucy.online/lucy-affiliate-plugin.zip">Download the plugin</a> or use the embed code below.</p><textarea rows="4" cols="60" readonly>
<script src="https://experience-lucy.online/widget.js?ref=${username}" async></script>
<script src="https://experience-lucy.online/chat-widget.js?ref=${username}" async></script>
<div class="lucy-leadgen-root" data-ref="${username}"></div>
  </textarea><p>Your referral link: <a href="https://experience-lucy.online/partner/${username}">https://experience-lucy.online/partner/${username}</a></p></body></html>`);
});

module.exports = router;
