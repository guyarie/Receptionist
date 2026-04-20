'use strict';

require('dotenv').config();
const axios = require('axios');

const CALENDLY_API_BASE = 'https://api.calendly.com';

function log(label, data) {
  console.log(`\n=== ${label} ===`);
  console.log(typeof data === 'string' ? data : JSON.stringify(data, null, 2));
}

async function request(label, url, params, token) {
  const headers = { Authorization: `Bearer ${token}` };
  log(`REQUEST: ${label}`, { url, params, headers: { Authorization: `Bearer ${token.slice(0, 8)}...` } });
  try {
    const res = await axios.get(url, { headers, params, timeout: 10000 });
    log(`RESPONSE: ${label} (${res.status})`, res.data);
    return res.data;
  } catch (err) {
    log(`ERROR: ${label}`, {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message,
    });
    return null;
  }
}

async function main() {
  const token = process.env.CALENDLY_API_TOKEN;
  const eventTypeUri = process.env.CALENDLY_EVENT_TYPE_URI;

  log('ENV CHECK', {
    CALENDLY_API_TOKEN: token ? `${token.slice(0, 8)}... (length: ${token.length})` : 'NOT SET',
    CALENDLY_EVENT_TYPE_URI: eventTypeUri || 'NOT SET',
  });

  if (!token) {
    console.error('\nFATAL: CALENDLY_API_TOKEN is not set in .env');
    process.exit(1);
  }

  // Step 1: get current user
  const userData = await request('GET /users/me', `${CALENDLY_API_BASE}/users/me`, {}, token);
  const userUri = userData?.resource?.uri;

  if (!userUri) {
    console.error('\nCould not get user URI — stopping.');
    return;
  }

  // Step 2: list event types
  const eventTypesData = await request(
    'GET /event_types',
    `${CALENDLY_API_BASE}/event_types`,
    { user: userUri, active: true },
    token,
  );

  const eventTypes = eventTypesData?.collection ?? [];
  log('EVENT TYPES SUMMARY', eventTypes.map(et => ({ name: et.name, uri: et.uri, slug: et.slug })));

  // Step 3: get available times for configured event type (next 7 days)
  const targetUri = eventTypeUri || eventTypes[0]?.uri;
  if (!targetUri) {
    log('SKIP', 'No event type URI available — set CALENDLY_EVENT_TYPE_URI in .env or ensure account has event types');
    return;
  }

  const now = new Date(Date.now() + 60 * 1000); // 1 min buffer — Calendly rejects start_time too close to now
  const weekOut = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  await request(
    'GET /event_type_available_times',
    `${CALENDLY_API_BASE}/event_type_available_times`,
    {
      event_type: targetUri,
      start_time: now.toISOString(),
      end_time: weekOut.toISOString(),
    },
    token,
  );
}

main();
