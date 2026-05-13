const express = require('express');
const router = express.Router();
const axios = require('axios');

router.post('/', async (req, res) => {
  const { message, ref } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });
  try {
    const completion = await axios.post('https://api.deepseek.com/v1/chat/completions', {
      model: 'deepseek-chat',
      messages: [{ role: 'system', content: 'You are a helpful AI assistant.' }, { role: 'user', content: message }],
      temperature: 0.7, max_tokens: 300
    }, {
      headers: { Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, 'Content-Type': 'application/json' }
    });
    const reply = completion.data.choices[0].message.content;
    if(ref) console.log('Chat partner:', ref);
    res.json({ reply });
  } catch(e) { res.status(500).json({ error: 'Chat failed' }); }
});
module.exports = router;
