const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
const NETLIFY_TOKEN = process.env.NETLIFY_API_TOKEN;
const SITE_ID = process.env.NETLIFY_SITE_ID;
const DAILY_LIMIT = 15;
const BATCH_DELAY = 4500;

const leadsFile = path.join(__dirname, '../data/leads.csv');
const SENT_URL = 'https://experience-lucy.online/sent.json';
const SUPPRESSION_URL = 'https://experience-lucy.online/suppression.json';
const SENDER_EMAIL = 'lucy@experience-lucy.online';
const SENDER_NAME = 'Lucy Ω';

// ── Netlify file helpers (persist sent/suppression) ──
async function getNetlifyFile(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

async function putNetlifyFile(path, content) {
  await fetch(`https://api.netlify.com/api/v1/sites/${SITE_ID}/files/${path}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${NETLIFY_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(content)
  });
}

// ── DeepSeek insight ──
async function getInsight() {
  if (!DEEPSEEK_KEY) return "Persistent AI memory combined with truth‑gated reasoning is quietly outpacing traditional marketing automation.";
  try {
    const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: 'In one sentence, state a compelling, non‑obvious reason why an independent, memory‑persistent AI system gives a CRM/marketing team an advantage over static enterprise tools. Make it sound like a natural insight, not a sales pitch.'
        }],
        temperature: 0.7,
        max_tokens: 100
      })
    });
    const data = await res.json();
    return data.choices[0].message.content.trim();
  } catch (e) {
    return "Persistent AI memory combined with truth‑gated reasoning is quietly outpacing traditional marketing automation.";
  }
}

// ── Send email ──
async function sendEmail(lead, insight) {
  if (!lead.email || !lead.email.includes('@') || !lead.name) return false;

  const emailBody = `Hi ${lead.name},

${insight}

That's the kind of thinking behind Lucy Ω — a living AI intelligence system from Barbados. Persistent memory, truth‑gated reasoning, and practical automation that evolves in public.

I thought it might resonate with what you're building at ${lead.company}. If you'd like a brief walkthrough of the actual system (no hard pitch), just reply.

Free access if you'd like to test it:
https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${encodeURIComponent(lead.email)}&name=${encodeURIComponent(lead.name)}

Unsubscribe anytime by replying "unsubscribe".

— Lucy Ω
https://experience-lucy.online`;

  const payload = {
    email: {
      from: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: lead.email, name: lead.name }],
      subject: `A thought on AI and ${lead.company}`,
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
      console.log(`✅ Sent: ${lead.email} (${lead.name})`);
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

console.log("🚀 Lucy Ω Persistent Outreach Cycle");

const leads = [];
fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', row => leads.push(row))
  .on('end', async () => {
    // Fetch persistent state from Netlify
    const [sent, suppression] = await Promise.all([
      getNetlifyFile(SENT_URL),
      getNetlifyFile(SUPPRESSION_URL)
    ]);

    const eligible = leads.filter(l =>
      l.email &&
      l.name &&
      !sent.includes(l.email.toLowerCase().trim()) &&
      !suppression.includes(l.email.toLowerCase().trim())
    ).slice(0, DAILY_LIMIT);

    console.log(`📊 Loaded ${leads.length} leads | ${eligible.length} eligible`);

    const insight = await getInsight();

    let sentCount = 0;
    for (const lead of eligible) {
      const ok = await sendEmail(lead, insight);
      if (ok) {
        sent.push(lead.email.toLowerCase().trim());
        sentCount++;
      }
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }

    // Persist sent list back to Netlify
    await putNetlifyFile('sent.json', [...new Set(sent)]);
    console.log(`🏁 Cycle complete. Sent today: ${sentCount}`);
  });
