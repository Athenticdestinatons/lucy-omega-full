const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '12');
const BATCH_DELAY = 5500;

const leadsFile = path.join(__dirname, '../data/leads.csv');
const sentFile = path.join(__dirname, '../data/sent.json');

let sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];

function sanitize(str) {
  return (str || '')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/"/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function callLLM(prompt, systemRole, model = 'openai/gpt-4o-mini') {
  if (OPENROUTER_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENROUTER_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: [{ role: 'system', content: systemRole }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 200 })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) return sanitize(data.choices[0].message.content);
    } catch (e) {}
  }
  if (GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${GROQ_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: systemRole }, { role: 'user', content: prompt }], temperature: 0.7, max_tokens: 200 })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) return sanitize(data.choices[0].message.content);
    } catch (e) {}
  }
  return "AI that never sleeps means you never miss another lead.";
}

async function orchestrateEmail(lead) {
  const { name, company = 'your business', email } = lead;
  const ctx = `${name} at ${company}`;

  const insight = await callLLM(
    `In one warm sentence, tell ${ctx} why a 24/7 AI assistant that never misses a lead gives them an edge.`,
    "You are an expert copywriter. No salesy language."
  );

  const subject = await callLLM(
    `Create a subject line under 50 characters for an email to ${ctx} about AI lead management.`,
    "You write short, curiosity-driven subject lines."
  );

  const body = `Hi ${name},\n\n${insight}\n\nI built Lucy Omega, a 24/7 AI assistant that lives on your website and never misses a lead.\n\nFree access: https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}\n\nUnsubscribe anytime by replying "unsubscribe".\n\n- Lucy Omega\nhttps://experience-lucy.online`;

  return {
    subject: sanitize(subject).substring(0, 60),
    body: sanitize(body)
  };
}

async function sendEmail(lead) {
  if (!lead.email?.includes('@') || !lead.name) return false;

  const { subject, body } = await orchestrateEmail(lead);

  const payload = {
    email: {
      from: { name: "Lucy Omega", email: "lucy@purenexus.online" },
      to: [{ email: lead.email, name: lead.name }],
      subject,
      text: body
    }
  };

  try {
    const res = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SENDPULSE_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`Sent: ${lead.email}`);
      return true;
    } else {
      console.log(`Failed ${lead.email}: ${res.status}`);
      return false;
    }
  } catch (e) {
    console.error(`Error ${lead.email}: ${e.message}`);
    return false;
  }
}

console.log("Lucy Omega Verified Sender Outreach (OpenRouter + Groq)");

const leads = [];
fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', row => leads.push(row))
  .on('end', async () => {
    const eligible = leads.filter(l => l.email && l.name && !sent.includes(l.email.toLowerCase().trim())).slice(0, DAILY_LIMIT);
    console.log(`Loaded ${leads.length} leads | ${eligible.length} eligible`);

    let sentCount = 0;
    for (const lead of eligible) {
      if (await sendEmail(lead)) {
        sent.push(lead.email.toLowerCase().trim());
        sentCount++;
      }
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }

    fs.writeFileSync(sentFile, JSON.stringify([...new Set(sent)], null, 2));
    console.log(`Cycle complete. Sent today: ${sentCount}`);
  });
