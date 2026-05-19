const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const fetch = require('node-fetch');

const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '15');
const SEND_ENDPOINT = process.env.SEND_ENDPOINT || 'https://lucy-omega-full.onrender.com/api/v1/send';

const leadsFile = path.join(__dirname, '../data/leads.csv');
const sentFile = path.join(__dirname, '../data/sent.json');
const suppressionFile = path.join(__dirname, '../data/suppression.json');

const sent = fs.existsSync(sentFile)
  ? JSON.parse(fs.readFileSync(sentFile, 'utf8'))
  : [];
const suppression = fs.existsSync(suppressionFile)
  ? JSON.parse(fs.readFileSync(suppressionFile, 'utf8'))
  : [];
const leads = [];

fs.createReadStream(leadsFile)
  .pipe(csv())
  .on('data', row => leads.push(row))
  .on('end', async () => {
    const eligible = leads
      .filter(
        lead =>
          lead.email &&
          lead.email.includes('@') &&
          !sent.includes(lead.email.trim()) &&
          !suppression.includes(lead.email.trim())
      )
      .slice(0, DAILY_LIMIT);

    console.log(`Leads total: ${leads.length}, eligible: ${eligible.length}`);

    for (const lead of eligible) {
      try {
        const res = await fetch(SEND_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: lead.email.trim(),
            name: lead.name || lead.company || 'there',
            company: lead.company || '',
            url: lead.url || ''
          })
        });

        const body = await res.json();
        if (res.ok && body.sent) {
          sent.push(lead.email.trim());
          console.log(`Sent: ${lead.email}`);
        } else {
          console.log(`Failed: ${lead.email} — ${JSON.stringify(body)}`);
        }
      } catch (err) {
        console.log(`Error: ${lead.email} — ${err.message}`);
      }

      // Polite interval between sends
      await new Promise(r => setTimeout(r, 3000));
    }

    // Update sent list
    fs.writeFileSync(sentFile, JSON.stringify(sent, null, 2));
    console.log(`Run complete. Total sent ever: ${sent.length}`);
  });
