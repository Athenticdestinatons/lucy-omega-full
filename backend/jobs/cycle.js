const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// ── Config from environment ──
const HASDATA_KEY = process.env.HASDATA_API_KEY;
const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const KEYWORD = process.env.KEYWORD || 'CRM consultant';
const COUNTRY = process.env.COUNTRY || 'US';
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '25');

const SENDER_EMAIL = 'lucy@purenexus.online';
const SENDER_NAME = 'Lucy Ω';

const sentFile = path.join(__dirname, '../data/sent.json');
const suppressionFile = path.join(__dirname, '../data/suppression.json');

let sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];
let suppression = fs.existsSync(suppressionFile) ? JSON.parse(fs.readFileSync(suppressionFile, 'utf8')) : [];

// ── HasData Google Maps scraper (proven schema) ──
async function getLeads() {
  if (!HASDATA_KEY) {
    console.error('HASDATA_API_KEY not set');
    return [];
  }

  const url = `https://www.google.com/maps/search/${encodeURIComponent(KEYWORD)}/${encodeURIComponent(COUNTRY)}?hl=en`;

  const res = await fetch('https://api.hasdata.com/scrape/web', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': HASDATA_KEY
    },
    body: JSON.stringify({
      url,
      proxyCountry: COUNTRY,
      proxyType: 'datacenter',
      blockResources: true,
      blockAds: true,
      extractEmails: true,
      aiExtractRules: {
        businesses: {
          type: 'list',
          output: 'array',
          description: 'Business listings with name, email, website',
          item: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Business name' },
              email: { type: 'string', description: 'Email address' },
              website: { type: 'string', description: 'Website URL' }
            }
          }
        }
      }
    })
  });

  const data = await res.json();

  if (data.error) {
    console.error('HasData error:', data.error);
    return [];
  }

  const businesses = (data.aiResponse?.businesses || [])
    .filter(b => b.email && b.email.includes('@'));

  return businesses.map(b => ({
    email: b.email.toLowerCase(),
    name: b.name || '',
    company: b.name || '',
    url: b.website || ''
  }));
}

// ── Email validation ──
async function validateEmail(email) {
  try {
    const res = await fetch(`https://api.mailcheck.ai/email/${encodeURIComponent(email)}`);
    if (!res.ok) return false;
    const body = await res.json();
    return !body.disposable && !body.blocked;
  } catch (e) { return false; }
}

// ── Send activation email ──
async function sendEmail(lead) {
  const username = lead.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const activationLink = `https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${encodeURIComponent(lead.email)}&username=${encodeURIComponent(username)}&name=${encodeURIComponent(lead.name)}`;

  const payload = {
    email: {
      from: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: lead.email, name: lead.name }],
      subject: `Free AI tool for ${lead.company || 'your business'}`,
      text: `Hi ${lead.name},\n\nI came across ${lead.company || 'your work'} and thought you'd be a great fit for Lucy Ω — a free AI growth platform for CRM and marketing professionals.\n\nYou'll get:\n- A lead‑generation widget (scrape LinkedIn/TikTok leads)\n- An AI chat assistant for your site\n- A partner link that pays you 15‑25% recurring commissions on every paid plan\n\nOne click to activate your free account and download the plugin:\n${activationLink}\n\nNo cost, no catch. Unsubscribe: reply "unsubscribe" and we'll remove you immediately.\n\n— Lucy Ω\nhttps://experience-lucy.online`
    }
  };

  const res = await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDPULSE_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  return res.ok && body.result;
}

// ── Main ──
(async () => {
  console.log('Cycle start');

  // 1. Get fresh leads
  const rawLeads = await getLeads();
  console.log(`Raw leads: ${rawLeads.length}`);

  // 2. Validate & filter
  const newLeads = [];
  for (const lead of rawLeads) {
    if (sent.includes(lead.email) || suppression.includes(lead.email)) continue;
    if (!(await validateEmail(lead.email))) {
      suppression.push(lead.email);
      console.log(`Suppressed: ${lead.email}`);
      continue;
    }
    newLeads.push(lead);
  }
  console.log(`Valid new leads: ${newLeads.length}`);

  // 3. Send up to daily limit
  const toSend = newLeads.slice(0, DAILY_LIMIT - sent.length);
  let sentCount = 0;
  for (const lead of toSend) {
    const ok = await sendEmail(lead);
    if (ok) {
      sent.push(lead.email);
      sentCount++;
      console.log(`✅ Sent: ${lead.email} (${lead.name})`);
    }
    await new Promise(r => setTimeout(r, 3000));
  }

  // 4. Persist state
  fs.writeFileSync(sentFile, JSON.stringify(sent, null, 2));
  fs.writeFileSync(suppressionFile, JSON.stringify([...new Set(suppression)], null, 2));
  console.log(`🚀 Cycle complete. Sent: ${sentCount}`);
})();
