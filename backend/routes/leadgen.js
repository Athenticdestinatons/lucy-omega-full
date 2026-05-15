const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const HASDATA_API_KEY = process.env.HASDATA_API_KEY;
const HASDATA_URL = 'https://api.hasdata.com/scrape/web';
const SENDPULSE_API_KEY = process.env.SENDPULSE_API_KEY;
const SENDER_EMAIL = 'lucy@purenexus.online';
const SENDER_NAME = 'Lucy Ω';
const PARTNERS_URL = 'https://raw.githubusercontent.com/Athenticdestinatons/lucy-omega-full/main/partners.json';

async function getPartnerEmail(username) {
  try {
    const res = await fetch(PARTNERS_URL);
    if (!res.ok) return null;
    const partners = await res.json();
    return partners[username] || null;
  } catch (e) { return null; }
}

async function sendLeadToPartner(partnerEmail, partnerUsername, leadData) {
  const subject = `New lead captured for ${partnerUsername}`;
  const text = `Hi ${partnerUsername},\n\nA new lead was just captured by your widget:\n\nName: ${leadData.name}\nHeadline: ${leadData.headline}\nEmail: ${leadData.email}\nCompany: ${leadData.company}\nLocation: ${leadData.location}\nScore: ${leadData.score}\n\nUse these details to follow up!\n\nYour referral link: https://experience-lucy.online/partner/${partnerUsername}\n\n— Lucy Ω`;

  await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDPULSE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: { text, subject, from: { name: SENDER_NAME, email: SENDER_EMAIL }, to: [{ name: partnerUsername, email: partnerEmail }] }
    })
  });
}

router.post('/scrape', async (req, res) => {
  const { url, ref } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required.' });

  const isLinkedIn = url.includes('linkedin.com/in/');
  const isTikTok = url.includes('tiktok.com/@');
  if (!isLinkedIn && !isTikTok)
    return res.status(400).json({ error: 'Only LinkedIn and TikTok URLs are supported.' });

  try {
    const hasdataPayload = {
      url: url,
      proxyCountry: 'US',
      proxyType: 'residential',
      blockResources: true,
      blockAds: true,
      jsRendering: true,
      extractEmails: true,
      aiExtractRules: {
        name: { description: "Full name of the person", type: "string" },
        headline: { description: "Professional headline or title", type: "string" },
        email: { description: "Email address if visible on the page", type: "string" },
        recentPost: { description: "Most recent post or activity summary", type: "string" },
        company: { description: "Current company name", type: "string" },
        location: { description: "Location of the person", type: "string" }
      }
    };

    const hasdataRes = await fetch(HASDATA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': HASDATA_API_KEY
      },
      body: JSON.stringify(hasdataPayload)
    });

    const raw = await hasdataRes.json();
    const extracted = raw.aiResponse || raw.extracted || {};

    const leadData = {
      name: extracted.name || 'Profile found',
      headline: extracted.headline || '',
      email: extracted.email || 'Email not publicly available',
      company: extracted.company || '',
      location: extracted.location || '',
      score: extracted.name ? 85 : 60,
      recentPost: extracted.recentPost || 'View full profile for recent activity'
    };

    if (ref) {
      console.log(`Lead scraped by partner: ${ref}`);
      const partnerEmail = await getPartnerEmail(ref);
      if (partnerEmail) {
        await sendLeadToPartner(partnerEmail, ref, leadData).catch(e => console.error('Failed to email partner lead:', e));
      }
    }

    res.json(leadData);
  } catch (err) {
    console.error('HasData scraping error:', err.message);
    res.status(500).json({ error: 'Scraping failed. Please try again.' });
  }
});

module.exports = router;
