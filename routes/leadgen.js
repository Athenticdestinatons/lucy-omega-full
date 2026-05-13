const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/scrape', async (req, res) => {
  const { url, ref } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });
  const isLinkedIn = url.includes('linkedin.com/in/');
  const isTikTok = url.includes('tiktok.com/@');
  if (!isLinkedIn && !isTikTok) return res.status(400).json({ error: 'Only LinkedIn/TikTok' });

  try {
    const profileSlug = url.split('/').pop().split('?')[0];
    const platform = isLinkedIn ? 'LinkedIn' : 'TikTok';
    const prompt = `Given this ${platform} profile URL: ${url}, generate a realistic professional profile. Return ONLY a JSON object: name, headline, email (fake), score (1-100), recentPost.`;
    const completion = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3, max_tokens: 200
    }, {
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }
    });
    let data = completion.data.choices[0].message.content;
    let lead;
    try { lead = JSON.parse(data); } catch(e) {
      lead = { name: profileSlug, headline: platform+' creator', email: profileSlug+'@example.com', score: 70, recentPost: 'Latest post' };
    }
    if(ref) console.log('Partner lead:', ref);
    res.json(lead);
  } catch(e) { res.status(500).json({ error: 'Scraping failed' }); }
});
module.exports = router;
