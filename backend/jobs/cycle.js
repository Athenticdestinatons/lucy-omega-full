const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '15');
const BATCH_DELAY = 3500;

const leadsFile = path.join(__dirname, '../data/leads.csv');
const sentFile = path.join(__dirname, '../data/sent.json');

let sent = [];
if (fs.existsSync(sentFile)) {
  sent = JSON.parse(fs.readFileSync(sentFile, 'utf8'));
}

async function sendEmail(lead) {
  if (!lead.email || !lead.email.includes('@')) return false;

  const emailPackage = {
    from: { name: "Lucy Ω", email: "lucy@purenexus.online" },
    to: [{ email: lead.email, name: lead.name || "" }],
    subject: `Lucy Ω — Free AI Growth Layer for ${lead.company || 'CRM Teams'}`,
    text: `Hi ${lead.name || 'Team'},

Lucy Ω grounded this insight: Independent AI systems that evolve in public are outperforming closed corporate tools in speed and adaptability.

I built Lucy Ω as a living intelligence layer — persistent memory, truth-gated reasoning, and real automation.

If you're in CRM / marketing automation, you might find value in:
• Lead generation co-pilot
• AI conversation engine
• Revenue share partnership (15-25%)

Free activation link:
https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${encodeURIComponent(lead.email)}

No cost. Unsubscribe anytime by replying "unsubscribe".

— Lucy Ω
Barbados-origin living intelligence
https://experience-lucy.online`
  };

  try {
    const res = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDPULSE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email: emailPackage })
    });

    const success = res.ok;
    if (success) {
      console.log(`✅ Sent: ${lead.email} (${lead.company || 'N/A'})`);
    } else {
      console.log(`❌ Failed: ${lead.email} | ${res.status}`);
    }
    return success;
  } catch (e) {
    console.log(`⚠️ Error sending to ${lead.email}:`, e.message);
    return false;
  }
}

console.log("🚀 Starting Lucy Ω CSV Email Cycle");

const leads = [];
fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', (row) => leads.push(row))
  .on('end', async () => {
    const eligible = leads.filter(l => 
      l.email && 
      !sent.includes(l.email.toLowerCase().trim())
    ).slice(0, DAILY_LIMIT);

    console.log(`📊 Loaded ${leads.length} leads | ${eligible.length} eligible`);

    let sentCount = 0;
    for (const lead of eligible) {
      const ok = await sendEmail(lead);
      if (ok) {
        sent.push(lead.email.toLowerCase().trim());
        sentCount++;
      }
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }

    fs.writeFileSync(sentFile, JSON.stringify([...new Set(sent)], null, 2));
    console.log(`🏁 Cycle complete. Sent today: ${sentCount}`);
  });
