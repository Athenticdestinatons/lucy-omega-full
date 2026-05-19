const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

// These values are stored as environment variables on Render – never hard‑coded
const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const SENDER_EMAIL = 'lucy@purenexus.online';
const SENDER_NAME = 'Lucy Ω';

router.post('/', async (req, res) => {
  const { email, name, company, url } = req.body;

  if (!email || !name) {
    return res.status(400).json({ error: 'Missing email or name' });
  }

  // Build the partner activation link
  const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const activationLink = `https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${encodeURIComponent(email)}&username=${encodeURIComponent(username)}&name=${encodeURIComponent(name)}`;

  const subject = company
    ? `Free AI tool for ${company}`
    : `A free AI growth tool for you, ${name}`;

  const text = `Hi ${name},

I came across ${company || 'your work'} and thought you'd be a great fit for Lucy Ω — a free AI growth platform for CRM and marketing professionals.

You'll get:
- A lead‑generation widget (scrape LinkedIn/TikTok leads)
- An AI chat assistant for your site
- A partner link that pays you 15‑25% recurring commissions on every paid plan

One click to activate your free account and download the plugin:
${activationLink}

No cost, no catch. Unsubscribe: reply "unsubscribe" and we'll remove you immediately.

— Lucy Ω
https://experience-lucy.online`;

  try {
    const sendRes = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SENDPULSE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: {
          text,
          subject,
          from: { name: SENDER_NAME, email: SENDER_EMAIL },
          to: [{ name, email }]
        }
      })
    });

    const sendBody = await sendRes.json();

    if (sendRes.ok && sendBody.result) {
      console.log(`Activation email sent to ${email}`);
      return res.json({ sent: true, email });
    } else {
      console.error(`SendPulse rejected: ${JSON.stringify(sendBody)}`);
      return res.status(502).json({ sent: false, error: sendBody });
    }
  } catch (err) {
    console.error(`Send failed for ${email}:`, err.message);
    return res.status(500).json({ sent: false, error: err.message });
  }
});

module.exports = router;
