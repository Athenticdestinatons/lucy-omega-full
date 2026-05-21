const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '15');
const BATCH_DELAY = 3000; // ms between sends

const leadsFile = path.join(__dirname, '../data/leads.csv');
const sentFile = path.join(__dirname, '../data/sent.json');
const suppressionFile = path.join(__dirname, '../data/suppression.json');

let sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];
let suppression = fs.existsSync(suppressionFile) ? JSON.parse(fs.readFileSync(suppressionFile, 'utf8')) : [];

async function sendEmail(lead) {
  if (!lead.email || !lead.name) return false;

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

  try {
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
  } catch (e) {
    console.error(`Send failed for ${lead.email}:`, e.message);
    return false;
  }
}

// Main execution
const leads = [];
fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', (row) => leads.push(row))
  .on('end', async () => {
    const eligible = leads.filter(l => 
      l.email && 
      !sent.includes(l.email.toLowerCase().trim()) && 
      !suppression.includes(l.email.toLowerCase().trim())
    ).slice(0, DAILY_LIMIT);

    console.log(`✅ Found ${leads.length} total leads | ${eligible.length} eligible`);

    let sentCount = 0;
    for (const lead of eligible) {
      const ok = await sendEmail(lead);
      if (ok) {
        sent.push(lead.email.toLowerCase().trim());
        sentCount++;
        console.log(`✅ Sent: ${lead.email} (${lead.name})`);
      }
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }

    // Persist
    fs.writeFileSync(sentFile, JSON.stringify([...new Set(sent)], null, 2));
    console.log(`🚀 Cycle complete. Sent today: ${sentCount}`);
  });
