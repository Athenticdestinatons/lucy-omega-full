const fetch = require('node-fetch');

const leads = [
  { email: 'jane@agencycrm.com', name: 'Jane' },
  { email: 'john@revopsconsulting.com', name: 'John' },
  { email: 'alex@gohighlevelpro.com', name: 'Alex' },
  { email: 'sam@emailmarketingco.com', name: 'Sam' },
  { email: 'taylor@funnelbuilder.io', name: 'Taylor' }
];

const NETLIFY_API_TOKEN = process.env.NETLIFY_API_TOKEN;
const NETLIFY_SITE_ID = '981e36cc-0f15-4d5a-9fae-218f158362b2';
const NETLIFY_ENV_URL = `https://api.netlify.com/api/v1/sites/${NETLIFY_SITE_ID}/env/PARTNER_EMAILS`;

async function run() {
  try {
    const getRes = await fetch(NETLIFY_ENV_URL, {
      headers: { Authorization: `Bearer ${NETLIFY_API_TOKEN}` }
    });
    if (!getRes.ok) throw new Error(`GET env failed: ${getRes.status}`);
    const envData = await getRes.json();
    const currentList = envData.value ? envData.value.split(',').map(e => e.trim()) : [];

    const newEmails = leads.map(l => l.email);
    const merged = [...new Set([...currentList, ...newEmails])];
    console.log(`Existing leads: ${currentList.length}, adding: ${newEmails.length}, total: ${merged.length}`);

    const putRes = await fetch(NETLIFY_ENV_URL, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${NETLIFY_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ value: merged.join(',') })
    });
    if (!putRes.ok) throw new Error(`PUT env failed: ${putRes.status} ${await putRes.text()}`);

    console.log('PARTNER_EMAILS updated successfully.');
  } catch (err) {
    console.error('Update failed:', err.message);
  }
}

run();
