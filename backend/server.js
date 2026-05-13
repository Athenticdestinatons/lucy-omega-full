const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

const DATA_DIR = './data';
const INFLUENCERS_FILE = path.join(DATA_DIR, 'influencers.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const CLICKS_FILE = path.join(DATA_DIR, 'clicks.json');

async function initData() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try { await fs.access(INFLUENCERS_FILE); } catch(e) { await fs.writeFile(INFLUENCERS_FILE, '[]'); }
  try { await fs.access(STATS_FILE); } catch(e) { await fs.writeFile(STATS_FILE, '{}'); }
  try { await fs.access(CLICKS_FILE); } catch(e) { await fs.writeFile(CLICKS_FILE, '[]'); }
}
initData();

async function readJSON(file) {
  const data = await fs.readFile(file, 'utf8');
  return JSON.parse(data);
}
async function writeJSON(file, data) {
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

async function ensureStats(username) {
  const stats = await readJSON(STATS_FILE);
  if (!stats[username]) stats[username] = { clicks: 0, conversions: 0, commission_estimate: 0 };
  await writeJSON(STATS_FILE, stats);
}

const DEEPSEEK_KEY = process.env.DEEPSEEK_KEY;
if (!DEEPSEEK_KEY) console.warn('DEEPSEEK_KEY not set');

async function callDeepSeek(prompt) {
  const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DEEPSEEK_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 200 })
  });
  const data = await response.json();
  return data.choices[0].message.content;
}

async function verifyAndApprove(username, socialLink, niche, claimedFollowers) {
  const prompt = `You are an influencer verification system. User claims ${claimedFollowers} followers on ${socialLink || 'unknown profile'} in the ${niche} niche. Return ONLY valid JSON: { "legit": true/false, "spam_score": 0-1, "estimated_real": number }. If profile looks real, set legit true and spam_score low.`;
  try {
    const resultText = await callDeepSeek(prompt);
    const match = resultText.match(/\{[\s\S]*\}/);
    const result = match ? JSON.parse(match[0]) : { legit: true, spam_score: 0.1, estimated_real: claimedFollowers };
    const finalStatus = result.legit && result.spam_score < 0.4 ? 'approved' : (result.spam_score < 0.7 ? 'pending_review' : 'rejected');
    const influencers = await readJSON(INFLUENCERS_FILE);
    const idx = influencers.findIndex(i => i.username === username);
    if (idx !== -1) {
      influencers[idx].status = finalStatus;
      influencers[idx].spam_score = result.spam_score;
      influencers[idx].verified_followers = result.estimated_real;
      await writeJSON(INFLUENCERS_FILE, influencers);
    }
    console.log(`Verification for ${username}: ${finalStatus}`);
  } catch (err) {
    console.error('DeepSeek error, auto‑approving:', err);
    const influencers = await readJSON(INFLUENCERS_FILE);
    const idx = influencers.findIndex(i => i.username === username);
    if (idx !== -1) {
      influencers[idx].status = 'approved';
      influencers[idx].spam_score = 0.1;
      influencers[idx].verified_followers = claimedFollowers;
      await writeJSON(INFLUENCERS_FILE, influencers);
    }
  }
}

app.post('/api/signup', async (req, res) => {
  const { username, name, email, social_link, followers, niche, platform } = req.body;
  if (!username || !email) return res.status(400).json({ error: 'Missing fields' });
  const influencers = await readJSON(INFLUENCERS_FILE);
  if (influencers.find(i => i.username === username)) return res.status(409).json({ error: 'Username taken' });
  influencers.push({ username, name, email, social_link, followers: followers || 0, niche, platform, status: 'pending', spam_score: null, verified_followers: null, created_at: new Date().toISOString() });
  await writeJSON(INFLUENCERS_FILE, influencers);
  await ensureStats(username);
  verifyAndApprove(username, social_link, niche, followers).catch(console.error);
  res.json({ success: true, message: 'Application received. Auto‑approval in progress.' });
});

app.get('/api/influencer/:username', async (req, res) => {
  const influencers = await readJSON(INFLUENCERS_FILE);
  const user = influencers.find(i => i.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.status !== 'approved') return res.status(403).json({ error: 'Not yet approved' });
  res.json({ username: user.username, name: user.name, status: user.status });
});

app.post('/api/track-click', async (req, res) => {
  const { referrer_username, referred_email } = req.body;
  if (!referrer_username) return res.status(400).json({ error: 'Missing referrer' });
  const stats = await readJSON(STATS_FILE);
  if (!stats[referrer_username]) stats[referrer_username] = { clicks: 0, conversions: 0, commission_estimate: 0 };
  stats[referrer_username].clicks++;
  await writeJSON(STATS_FILE, stats);
  const clicks = await readJSON(CLICKS_FILE);
  clicks.push({ referrer_username, referred_email, clicked_at: new Date().toISOString() });
  await writeJSON(CLICKS_FILE, clicks);
  res.json({ success: true });
});

app.get('/api/dashboard/:username', async (req, res) => {
  const influencers = await readJSON(INFLUENCERS_FILE);
  const user = influencers.find(i => i.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const stats = await readJSON(STATS_FILE);
  const userStats = stats[req.params.username] || { clicks: 0, conversions: 0, commission_estimate: 0 };
  res.json({ username: req.params.username, status: user.status, verified_followers: user.verified_followers, ...userStats });
});

app.post('/api/ai-tool', async (req, res) => {
  const prompts = {
    headline: 'Generate 10 catchy headlines for: ', email: 'Write a short marketing email for: ',
    youtube_title: 'Generate 10 YouTube titles for: ', script: 'Write a 60‑second video script for: ',
    landing_page: 'Generate landing page copy for: ', ad_copy: 'Write 3 ad copies for: ',
    affiliate_promo: 'Write affiliate promo copy for: ', review_writer: 'Write a 300‑word review for: ',
    chat: 'You are Lucy, an AI assistant for creators. Answer concisely: '
  };
  const system = prompts[req.body.tool];
  if (!system) return res.status(400).json({ error: 'Unknown tool' });
  try {
    const result = await callDeepSeek(system + req.body.prompt);
    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));

app.use('/api/v1/leadgen', require('./routes/leadgen'));
app.use('/api/v1/chat', require('./routes/chat'));
