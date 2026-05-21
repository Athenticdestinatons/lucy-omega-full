const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const HASDATA_KEY = process.env.HASDATA_API_KEY;
const KEYWORDS_STR = process.env.KEYWORDS || 'CRM consultant';
const KEYWORDS = KEYWORDS_STR.split(',').map(k => k.trim()).filter(k => k);
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '15');
// Try multiple English‑speaking countries to broaden results
const COUNTRIES = (process.env.COUNTRIES || 'US,UK,Canada,Australia,New Zealand').split(',').map(c => c.trim());
const LANGUAGE = process.env.LANGUAGE || 'en';

const sentFile = path.join(__dirname, '../data/sent.json');
const suppressionFile = path.join(__dirname, '../data/suppression.json');
const sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];
const suppression = fs.existsSync(suppressionFile) ? JSON.parse(fs.readFileSync(suppressionFile, 'utf8')) : [];

async function discoverLeads(keyword, country) {
  if (!HASDATA_KEY) return [];
  try {
    const res = await fetch('https://api.hasdata.com/scrape/web', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': HASDATA_KEY },
      body: JSON.stringify({
        url: `https://www.google.com/maps/search/${encodeURIComponent(keyword)}/${encodeURIComponent(country)}?hl=${LANGUAGE}`,
        proxyCountry: country,
        proxyType: 'datacenter',
        blockResources: true,
        blockAds: true,
        extractEmails: true,
        aiExtractRules: {
          businesses: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                email: { type: 'string' },
                website: { type: 'string' }
              }
            }
          }
        }
      })
    });
    const data = await res.json();
    return (data.aiResponse?.businesses || [])
      .filter(b => b.email && b.email.includes('@'))
      .map(b => ({
        email: b.email.toLowerCase(),
        name: b.name || '',
        company: b.name || '',
        url: b.website || '',
        keyword,
        country
      }));
  } catch (e) { return []; }
}

async function sendEmail(lead) {
  const username = lead.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const activationLink = `https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${encodeURIComponent(lead.email)}&username=${encodeURIComponent(username)}&name=${encodeURIComponent(lead.name)}`;
  const payload = {
    email: {
      from: { name: 'Lucy Ω', email: 'lucy@purenexus.online' },
      to: [{ email: lead.email, name: lead.name }],
      subject: `Free AI tool for ${lead.company || 'your business'}`,
      text: `Hi ${lead.name},\n\nI came across ${lead.company || 'your work'} and thought you'd be a great fit for Lucy Ω — a free AI growth platform for CRM and marketing professionals.\n\nYou'll get:\n- A lead‑generation widget (scrape LinkedIn/TikTok leads)\n- An AI chat assistant for your site\n- A partner link that pays you 15‑25% recurring commissions on every paid plan\n\nOne click to activate your free account and download the plugin:\n${activationLink}\n\nNo cost, no catch. Unsubscribe: reply "unsubscribe" and we'll remove you immediately.\n\n— Lucy Ω\nhttps://experience-lucy.online`
    }
  };
  const res = await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${SENDPULSE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await res.json();
  return res.ok && body.result;
}

(async () => {
  console.log('Cycle start');
  let totalAdded = 0;

  for (const kw of KEYWORDS) {
    for (const country of COUNTRIES) {
      const leads = await discoverLeads(kw, country);
      for (const lead of leads) {
        if (sent.includes(lead.email) || suppression.includes(lead.email)) continue;
        sent.push(lead.email);
        totalAdded++;
        if (totalAdded >= DAILY_LIMIT * 2) break; // stop discovery once we have enough
      }
      if (totalAdded >= DAILY_LIMIT * 2) break;
      await new Promise(r => setTimeout(r, 2000)); // polite pause between requests
    }
    if (totalAdded >= DAILY_LIMIT * 2) break;
  }

  console.log(`Discovered & queued: ${totalAdded}`);

  let sentCount = 0;
  const unsent = sent.filter(e => !suppression.includes(e)).slice(-DAILY_LIMIT);
  for (const email of unsent) {
    try {
      const lead = { email, name: email.split('@')[0], company: '' };
      const ok = await sendEmail(lead);
      if (ok) { console.log(`Sent: ${email}`); sentCount++; }
    } catch (e) { console.error(`Failed: ${email}`, e.message); }
    await new Promise(r => setTimeout(r, 3000));
  }

  fs.writeFileSync(sentFile, JSON.stringify(sent, null, 2));
  console.log(`Cycle complete. Sent: ${sentCount}`);
})();
