const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const SENDPULSE_API_KEY = process.env.SENDPULSE_API_KEY;
const SENDER_EMAIL = 'lucy@purenexus.online';
const SENDER_NAME = 'Lucy Ω';
const NETLIFY_TOKEN = process.env.NETLIFY_API_TOKEN;
const SITE_ID = process.env.NETLIFY_SITE_ID;

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

// Save partner email mapped to username
async function savePartnerEmail(username, email) {
  const url = `https://experience-lucy.online/partners.json`;
  let partners = {};
  try {
    const res = await fetch(url);
    if (res.ok) partners = await res.json();
  } catch (e) { /* use empty */ }
  partners[username] = email;
  await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/files/partners.json`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${NETLIFY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(partners)
  });
}

router.get('/activate', async (req, res) => {
  const { email, username, name } = req.query;
  if (!email || !username) return res.status(400).send('Missing email or username.');
  const partnerName = name || username;

  // Save partner email for lead notifications
  await savePartnerEmail(username, email);

  // Email 1 – Welcome + plugin download
  await sendEmail(partnerName, email,
    'Your Free Lucy Ω Lead Enrichment Widget is Ready',
    `Hi ${partnerName},\n\nYour partner account is now active. Download the plugin:\nhttps://experience-lucy.online/lucy-affiliate-plugin.zip\n\nReferral link: https://experience-lucy.online/partner/${username}\n\n— Lucy Ω Team`
  );

  // Email 2 – CRM tips
  await sendEmail(partnerName, email,
    'How CRM operators & agencies use Lucy Ω',
    `Hi ${partnerName},\n\nAdd the widget to your Tools page, share your referral link in newsletters, and watch the leads come in.\n\nYour referral: https://experience-lucy.online/partner/${username}\n\n— Lucy Ω Team`
  );

  // Email 3 – Monetisation
  await sendEmail(partnerName, email,
    'Your recurring revenue + JobClub™',
    `Hi ${partnerName},\n\n5 Scale users = $248.75/month to you.\n\nYour referral: https://experience-lucy.online/partner/${username}\n\n— Lucy Ω Team`
  );

  res.send(`<html><body style="font-family:sans-serif;text-align:center;padding:40px;"><h1>🎉 You're All Set, ${partnerName}!</h1><p>Your widgets are ready. <a href="https://experience-lucy.online/lucy-affiliate-plugin.zip">Download the plugin</a></p><p>Referral link: <a href="https://experience-lucy.online/partner/${username}">https://experience-lucy.online/partner/${username}</a></p></body></html>`);
});

module.exports = router;
