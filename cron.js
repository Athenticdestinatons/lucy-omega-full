const fetch = require('node-fetch');

const SENDPULSE_API_KEY = process.env.SENDPULSE_API_KEY;
const GITHUB_CSV_URL = process.env.CSV_URL;
const DAILY_LIMIT = parseInt(process.env.DAILY_LIMIT || '25');

const sentEmails = new Set(); // ephemeral dedup within a single run

async function sendEmail(toName, toEmail, subject, text) {
  await fetch('https://api.sendpulse.com/smtp/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDPULSE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: {
        text,
        subject,
        from: {
          name: 'Lucy Ω',
          email: 'lucy@purenexus.online'
        },
        to: [{ name: toName, email: toEmail }]
      }
    })
  });
}

async function main() {
  const response = await fetch(GITHUB_CSV_URL);
  const csv = await response.text();

  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',');

  let count = 0;

  for (const line of lines.slice(1)) {
    if (count >= DAILY_LIMIT) break;

    const values = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h.trim()] = values[i]?.trim() || '';
    });

    const email = row.Email;
    if (!email || sentEmails.has(email)) continue;

    const username = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');

    const activationLink =
      `https://lucy-omega-full.onrender.com/api/v1/partner/activate` +
      `?email=${encodeURIComponent(email)}` +
      `&username=${username}` +
      `&name=${encodeURIComponent(row.FirstName)}`;

    const subject = `Quick partnership idea for ${row.BlogName}`;

    const text = `Hi ${row.FirstName},

I came across your recent content on ${row.RecentPostTopic}.

Lucy Ω is an AI platform for creators and bloggers.

We offer:
- free AI tools
- embeddable widgets
- WordPress plugin
- recurring commissions

Activate instantly:
${activationLink}

No cost.

Best,
Lucy Ω
https://experience-lucy.online`;

    try {
      await sendEmail(row.FirstName, email, subject, text);
      sentEmails.add(email);
      count++;
      console.log('Sent:', email);
    } catch (e) {
      console.error('Failed:', email, e);
    }
  }

  console.log('Done:', count);
}

main();
