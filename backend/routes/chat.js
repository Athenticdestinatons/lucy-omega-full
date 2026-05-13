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
      temperature: 0.7,
      max_tokens: 300
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

router.post('/', async (req, res) => {
  const { message, ref } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required.' });

  try {
    const reply = await callDeepSeek(
      `You are Lucy, an AI assistant for creators. Answer concisely: ${message}`
    );
    if (ref) console.log(`Chat used by partner: ${ref}`);
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat service temporarily unavailable.' });
  }
});

module.exports = router;
