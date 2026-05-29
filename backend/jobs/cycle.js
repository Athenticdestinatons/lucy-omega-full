const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

// ── Environment variables ──
const SENDPULSE_KEY = process.env.SENDPULSE_API_KEY;
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '12');
const BATCH_DELAY = 5500;

const leadsFile = path.join(__dirname, '../data/leads.csv');
const sentFile = path.join(__dirname, '../data/sent.json');

let sent = fs.existsSync(sentFile) ? JSON.parse(fs.readFileSync(sentFile, 'utf8')) : [];

// ── Unified LLM caller (OpenRouter primary, Groq fallback) ──
async function callLLM(prompt, systemRole, model = 'openai/gpt-4o-mini') {
  // Try OpenRouter first
  if (OPENROUTER_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemRole },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 250
        })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content.trim();
      }
    } catch (e) { console.warn('OpenRouter failed, falling back to Groq:', e.message); }
  }

  // Fallback to Groq
  if (GROQ_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: systemRole },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 250
        })
      });
      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        return data.choices[0].message.content.trim();
      }
    } catch (e) { console.warn('Groq failed:', e.message); }
  }

  return "Intelligence layer offline – using default insight.";
}

// ── Multi‑Agent Orchestration ──
async function orchestrateEmail(lead) {
  const { name, company = 'your business', industry = 'local business', email } = lead;
  const ctx = `${name} at ${company} (${industry})`;

  const plan = await callLLM(
    `Analyze this lead: ${ctx}. Identify 2‑3 pain points where persistent AI intelligence creates an unfair advantage.`,
    "You are the Strategy Planner for Experience Lucy Online – The Benchmark in AI Intelligence."
  );

  const insight = await callLLM(
    `From this plan: "${plan}". Create ONE warm, authoritative sentence explaining why Lucy (The Benchmark in AI Intelligence), that never misses leads and lives on their website, gives ${company} a decisive edge.`,
    "You are the Insight Architect. Be insightful, never salesy."
  );

  const valueProp = await callLLM(
    `Using insight: "${insight}". Write 2‑3 compelling sentences on how Lucy delivers 24/7 intelligence, automatic follow‑ups, and lead capture for ${ctx}.`,
    "You are the Value Architect for The Benchmark in AI Intelligence."
  );

  const subject = await callLLM(
    `Generate the single best high‑open‑rate subject line for ${ctx} that subtly references benchmark AI intelligence. Under 60 characters.`,
    "You are the Conversion Optimizer."
  );

  const refinedBody = await callLLM(
    `Critique and improve this draft for authenticity, benchmark positioning, and conversion:\n\nSubject: ${subject}\nInsight: ${insight}\nValue: ${valueProp}\n\nMake it concise, warm, and benchmark‑level.`,
    "You are the Quality Critic for Experience Lucy Online."
  );

  const activationLink = `https://lucy-omega-full.onrender.com/api/v1/partner/activate?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`;

  return {
    subject,
    body: `Hi ${name},\n\n${refinedBody}\n\nExperience the benchmark: ${activationLink}\n\nUnsubscribe anytime by replying \"unsubscribe\".\n\n- Lucy Omega\nThe Benchmark in AI Intelligence\nhttps://experience-lucy.online`
  };
}

// ── Send email via SendPulse ──
async function sendEmail(lead) {
  if (!lead.email?.includes('@') || !lead.name) return false;

  try {
    const { subject, body } = await orchestrateEmail(lead);

    const payload = {
      email: {
        from: { name: "Lucy Omega", email: "lucy@experience-lucy.online" },
        to: [{ email: lead.email, name: lead.name }],
        subject,
        text: body
      }
    };

    const res = await fetch('https://api.sendpulse.com/smtp/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDPULSE_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log(`✅ Benchmark email sent: ${lead.email}`);
      return true;
    } else {
      console.log(`❌ Send failed ${lead.email}: ${res.status}`);
      return false;
    }
  } catch (e) {
    console.error(`⚠️ Orchestration failed for ${lead.email}:`, e.message);
    return false;
  }
}

// ── Main Cycle ──
console.log("🚀 Experience Lucy Online – Benchmark Intelligence Orchestration Active (OpenRouter + Groq)");

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
      const success = await sendEmail(lead);
      if (success) {
        sent.push(lead.email.toLowerCase().trim());
        sentCount++;
      }
      await new Promise(r => setTimeout(r, BATCH_DELAY));
    }

    fs.writeFileSync(sentFile, JSON.stringify([...new Set(sent)], null, 2));
    console.log(`🏁 Orchestration cycle complete. Benchmark emails sent today: ${sentCount}`);
  });
