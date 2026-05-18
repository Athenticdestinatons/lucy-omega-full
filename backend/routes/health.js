const express = require('express');
const router = express.Router();
const fetch = require('node-fetch');

const CHECKS = {
  csv: {
    url: 'https://raw.githubusercontent.com/Athenticdestinatons/lucy-omega-full/main/partner-outreach.csv',
    description: 'Outreach CSV accessible'
  },
  sendpulse: {
    url: 'https://api.sendpulse.com/smtp/senders',
    headers: { Authorization: `Bearer ${process.env.SENDPULSE_API_KEY}` },
    description: 'SendPulse API connected'
  },
  activation: {
    url: `${process.env.RENDER_EXTERNAL_URL || 'https://lucy-omega-full.onrender.com'}/api/v1/partner/activate?email=health@test.com&username=healthcheck&name=Health`,
    description: 'Activation endpoint live'
  },
  partners: {
    url: 'https://raw.githubusercontent.com/Athenticdestinatons/lucy-omega-full/main/partners.json',
    description: 'Partner database accessible'
  },
  hasdata: {
    url: 'https://api.hasdata.com/scrape/web',
    headers: { 'x-api-key': process.env.HASDATA_API_KEY },
    description: 'HasData API reachable (key valid)'
  }
};

router.get('/', async (req, res) => {
  const results = {};
  let healthy = true;

  for (const [name, config] of Object.entries(CHECKS)) {
    try {
      const opts = config.headers ? { headers: config.headers } : {};
      const resp = await fetch(config.url, opts);
      results[name] = resp.ok ? '✅' : `❌ HTTP ${resp.status}`;
      if (!resp.ok) healthy = false;
    } catch (e) {
      results[name] = `❌ ${e.message}`;
      healthy = false;
    }
  }

  res.json({
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    results
  });
});

module.exports = router;
