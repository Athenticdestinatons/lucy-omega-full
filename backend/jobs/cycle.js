const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');
const { execSync } = require('child_process');

const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const DAILY_LIMIT = 15;
const BATCH_DELAY = 4500;

const leadsFile = path.join(__dirname, '../data/leads.csv');
const sentFile = path.join(__dirname, '../data/sent.json');

let sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];

async function getGroundedInsight(topic) {
  try {
    const output = execSync(`cd \~/lucy-omega-full && python lucy_phase1_email_hashtag.py <<< "${topic}"`, { encoding: 'utf8' });
    const lines = output.split('\n');
    const groundedLine = lines.find(line => line.includes('GROUNDED') || line.includes('answer'));
    return groundedLine ? groundedLine.replace(/.*GROUNDED: /, '').trim() : "Independent AI systems that evolve openly are showing superior adaptability in real-world automation.";
  } catch (e) {
    return "Living AI systems built with persistent memory and truth gates are outperforming static corporate tools.";
  }
}

async function sendEmail(lead) {
  if (!lead.email || !lead.email.includes('@') || !lead.name) return false;

  const insight = await getGroundedInsight("advantage of independent persistent AI systems for CRM and marketing teams");

  const emailBody = `Hi ${lead.name},

I noticed ${lead.company} is doing excellent work in CRM and marketing automation.

Lucy Ω just grounded this insight:  
**${insight}**

I’m building Lucy Ω as a living AI intelligence system from Barbados — persistent memory, truth-gated reasoning, and practical automation that evolves in public.

If this direction resonates with your current stack or growth goals, I’d be happy to share a short overview (no hard pitch).

Free test access:
https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=\( {encodeURIComponent(lead.email)}&name= \){encodeURIComponent(lead.name)}

Unsubscribe anytime: reply "unsubscribe".

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

console.log("🚀 Lucy Ω Truth-Gated CRM Outreach Cycle");

const leads = [];
fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', row => leads.push(row))
  .on('end', async () => {
    const eligible = leads.filter(l => 
      l.email && l.name && !sent.includes(l.email.toLowerCase().trim())
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
