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

async function getGroundedInsight() {
  // Placeholder for Lucy truth gate (you can connect later)
  return "Independent AI systems with persistent memory and public evolution are showing faster iteration and better user trust than closed corporate tools.";
}

async function sendEmail(lead) {
  if (!lead.email || !lead.name || !lead.company) return false;

  const insight = await getGroundedInsight();

  const emailBody = `Hi ${lead.name},

I came across your work at ${lead.company} and wanted to reach out personally.

Lucy Ω grounded this insight:  
**${insight}**

I'm building Lucy Ω — a living AI intelligence system from Barbados focused on persistent memory, truth-gated reasoning, and real automation for growth teams.

Would you be open to a short, no-pressure overview of how it works?

Free activation link:
https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=\( {encodeURIComponent(lead.email)}&name= \){encodeURIComponent(lead.name)}

Unsubscribe anytime by replying "unsubscribe".

Best regards,
Lucy Ω
Barbados-origin living AI intelligence
https://experience-lucy.online`;

  const payload = {
    email: {
      from: { name: "Lucy Ω", email: "lucy@purenexus.online" },
      to: [{ email: lead.email, name: lead.name }],
      subject: `Lucy Ω — AI insight for ${lead.company}`,
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
      console.log(`❌ Failed: ${lead.email} | ${res.status}`);
      return false;
    }
  } catch (e) {
    console.log(`⚠️ Error: ${lead.email}`);
    return false;
  }
}

console.log("🚀 Lucy Ω Clean High-Quality Outreach Cycle");

const leads = [];
fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', row => leads.push(row))
  .on('end', async () => {
    const eligible = leads.filter(l => 
      l.email && 
      l.name && 
      l.company &&
      !sent.includes(l.email.toLowerCase().trim())
    ).slice(0, DAILY_LIMIT);

    console.log(`📊 Loaded ${leads.length} leads | ${eligible.length} eligible today`);

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
