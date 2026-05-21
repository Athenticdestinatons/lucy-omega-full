const express = require('express');
const router = express.Router();
const twilio = require('twilio');

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_WHATSAPP_NUMBER
} = process.env;

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
const FROM = `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

// ── Inbound webhook (Twilio points here) ──
router.post('/webhook', async (req, res) => {
  const incomingMsg = req.body.Body?.trim().toLowerCase() || '';
  const from = req.body.From;

  let reply = 'Hi! Reply ACTIVATE to get your free Lucy Ω partner account.';

  if (incomingMsg === 'activate') {
    reply = 'To activate your partner account, visit https://experience-lucy.online/partner-signup or reply with your email.';
  } else if (incomingMsg.includes('@') && incomingMsg.includes('.')) {
    const email = incomingMsg;
    const username = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    const activationLink = `https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${email}&username=${username}&name=${username}`;
    try {
      await fetch(activationLink);
      reply = `✅ Your partner account is being activated! Check ${email} for your welcome email and plugin download.`;
    } catch (e) {
      reply = 'Something went wrong. Please visit https://experience-lucy.online/partner-signup to activate manually.';
    }
  }

  const twiml = new twilio.twiml.MessagingResponse();
  twiml.message(reply);
  res.writeHead(200, { 'Content-Type': 'text/xml' });
  res.end(twiml.toString());
});

// ── Outbound send (optional) ──
router.post('/send', async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message) return res.status(400).json({ error: 'Missing to or message' });

  try {
    const msg = await client.messages.create({
      from: FROM,
      to: `whatsapp:${to}`,
      body: message
    });
    res.json({ sent: true, sid: msg.sid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
