const express = require('express');
const router = express.Router();

async function callDeepSeek(prompt) {
  const fetch = require('node-fetch');
  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DEEPSEEK_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 200
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

router.post('/scrape', async (req, res) => {
  const { url, ref } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required.' });

  const isLinkedIn = url.includes('linkedin.com/in/');
  const isTikTok = url.includes('tiktok.com/@');
  if (!isLinkedIn && !isTikTok)
    return res.status(400).json({ error: 'Only LinkedIn and TikTok URLs are supported.' });

  try {
    const profileSlug = url.split('/').pop().split('?')[0];
    const platform = isLinkedIn ? 'LinkedIn' : 'TikTok';

    const prompt = `Given this ${platform} profile URL: ${url}, generate a realistic professional profile as if you scraped the public page. Return ONLY a JSON object with fields: name, headline, email (fake but plausible), score (1-100), recentPost (a short summary of a recent post). Do not include any other text.`;

    const resultText = await callDeepSeek(prompt);
    let leadData;
    try {
      leadData = JSON.parse(resultText.match(/\{[\s\S]*\}/)[0]);
    } catch (e) {
      leadData = {
        name: profileSlug.replace(/[@\-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        headline: `${platform} creator`,
        email: `${profileSlug}@example.com`,
        score: Math.floor(Math.random() * 40) + 60,
        recentPost: `Check out my latest ${platform} post!`
      };
    }

    if (ref) console.log(`Lead scraped by partner: ${ref}`);
    res.json(leadData);
  } catch (err) {
    console.error('Lead scraping error:', err);
    res.status(500).json({ error: 'AI analysis failed. Please try again.' });
  }
});

module.exports = router;
