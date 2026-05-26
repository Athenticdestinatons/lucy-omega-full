const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const DAILY_LIMIT = 15;
const BATCH_DELAY = 4500;

const leadsFile = path.join(__dirname, '../data/leads.csv');
const sentFile = path.join(__dirname, '../data/sent.json');

let sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];

async function sendEmail(lead) {
  if (!lead.email || !lead.email.includes('@') || !lead.name) return false;

  const emailBody = `Hi ${lead.name},

I noticed ${lead.company} is doing strong work in CRM and marketing automation.

I'm building Lucy Ω — a living AI intelligence system from Barbados that evolves in public. It features persistent memory, truth-gated reasoning, and practical automation tools for growth teams.

I thought it might be relevant for your stack. Would you be open to a short overview (no hard pitch — just the actual system and how it works)?

Free access link if you'd like to test it:
https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=\( {encodeURIComponent(lead.email)}&name= \){encodeURIComponent(lead.name)}

Unsubscribe anytime by replying "unsubscribe".

Best,
Lucy Ω
Barbados-origin living AI intelligence
https://experience-lucy.online`;

  const payload = {
    email: {
      from: { name: "Lucy Ω", email: "lucy@purenexus.online" },
      to: [{ email: lead.email, name: lead.name }],
      subject: `Lucy Ω — AI layer for ${lead.company}`,
      text: emailBody
    }
  };

  try {
    const res = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDPULSE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`✅ Sent: \( {lead.email} ( \){lead.name} @ ${lead.company})`);
      return true;
    } else {
      console.log(`❌ Failed: ${lead.email} | Status: ${res.status}`);
      return false;
    }
  } catch (e) {
    console.log(`⚠️ Error sending to ${lead.email}`);
    return false;
  }
}

console.log("🚀 Lucy Ω Clean CRM Outreach Cycle Started");

const leads = [];
fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', row => leads.push(row))
  .on('end', async () => {
    const eligible = leads.filter(l => 
      l.email && l.name && !sent.includes(l.email.toLowerCase().trim())
    ).slice(0, DAILY_LIMIT);

    console.log(`📊 Loaded ${leads.length} leads | ${eligible.length} eligible for today`);

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
