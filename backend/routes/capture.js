const express = require('express');
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Use existing Supabase env vars (already on your Render)
const supabaseUrl = process.env.SUPABASE_URL || 'https://xyzcompany.supabase.co';
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// ── GET /referral?ref=username ──
router.get('/referral', (req, res) => {
  const ref = req.query.ref || 'partner';
  const referralLink = `https://experience-lucy.online/partner/${ref}`;
  res.json({ referral_link: referralLink, client: ref });
});

// ── POST /subscribe ──
router.post('/subscribe', async (req, res) => {
  const { email, category, client } = req.body;
  if (!email) return res.status(400).json({ error: 'Email required' });

  if (supabase) {
    try {
      await supabase.from('subscribers').insert([{ email, category, client, created_at: new Date() }]);
    } catch (e) { console.error('Supabase insert error:', e.message); }
  }

  console.log(`Subscribed: ${email} (${category})`);
  res.json({ message: 'Subscribed successfully' });
});

// ── POST /ticket ──
router.post('/ticket', async (req, res) => {
  const { message, client } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const ticketId = 'TKT-' + Date.now();
  if (supabase) {
    try {
      await supabase.from('tickets').insert([{ id: ticketId, message, client, status: 'open', created_at: new Date() }]);
    } catch (e) { console.error('Supabase insert error:', e.message); }
  }

  console.log(`Ticket ${ticketId} created`);
  res.json({ ticket_id: ticketId });
});

module.exports = router;
