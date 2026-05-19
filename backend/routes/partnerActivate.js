const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const SENDPULSE_API_KEY = process.env.SENDPULSE_API_KEY;
const SENDER_EMAIL = 'lucy@purenexus.online';
const SENDER_NAME = 'Lucy Ω';

async function sendEmail(toName, toEmail, subject, text) {
  await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDPULSE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: { text, subject, from: { name: SENDER_NAME, email: SENDER_EMAIL }, to: [{ name: toName, email: toEmail }] }
    })
  });
}

router.get('/activate', async (req, res) => {
  const { email, username, name } = req.query;
  if (!email || !username) return res.status(400).send('Missing email or username.');
  const partnerName = name || username;

  // Email 1 – Day 0: welcome + plugin + affiliate link
  await sendEmail(partnerName, email,
    'Your Free Lucy Ω Partner Account is Ready',
    `Hi ${partnerName},\n\nYour free partner account is active.\n\n→ Install the widget: https://experience-lucy.online/download\n→ Your affiliate link: https://experience-lucy.online/?ref=${username}\n\nYou now earn 20% recurring on every Pro upgrade from your referrals.\n\nWelcome to the system.\n\nLucy Ω Team`
  );

  // Email 2 – Day 1: quick start
  await sendEmail(partnerName, email,
    'Day 1 – Add the Widget to Your Site in 60 Seconds',
    `Hi ${partnerName},\n\nQuick start:\n\n1. Copy the embed code\n2. Paste on any page\n3. Watch leads come in automatically\n\nYour first referral could pay your next coffee.\n\nDashboard: https://experience-lucy.online/dashboard\n\nLucy Ω`
  );

  // Email 3 – Day 3: swipe files
  await sendEmail(partnerName, email,
    'Ready-Made CRM Funnels for Your Audience',
    `Hi ${partnerName},\n\nHere are 3 swipe files you can use today:\n\n• HubSpot users\n• GoHighLevel agencies\n• RevOps operators\n\nCopy → paste → earn 20% recurring.\n\nTools page: https://experience-lucy.online/tools\n\nLucy Ω`
  );

  // Email 4 – Day 7: first commission
  await sendEmail(partnerName, email,
    'Your First Commission Is Waiting',
    `Hi ${partnerName},\n\nCheck your dashboard: https://experience-lucy.online/dashboard\n\nShare your link this week and turn one signup into recurring revenue.\n\nNeed help with copy or strategy? Reply to this email.\n\nLucy Ω`
  );

  res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;"><h1>🎉 You're All Set, ${partnerName}!</h1><p>Your widgets are ready. <a href="https://experience-lucy.online/lucy-affiliate-plugin.zip">Download the plugin</a></p><p>Referral link: <a href="https://experience-lucy.online/?ref=${username}">https://experience-lucy.online/?ref=${username}</a></p></body></html>`);
});

module.exports = router;
