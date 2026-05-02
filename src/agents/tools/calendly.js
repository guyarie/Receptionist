'use strict';

const axios = require('axios');

const CALENDLY_API_BASE = 'https://api.calendly.com';

async function getUser(apiToken) {
  const res = await axios.get(`${CALENDLY_API_BASE}/users/me`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    timeout: 8000,
  });
  return res.data.resource;
}

async function getEventTypes(apiToken, userUri) {
  const res = await axios.get(`${CALENDLY_API_BASE}/event_types`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    params: { user: userUri, active: true },
    timeout: 8000,
  });
  return res.data.collection;
}

async function getEventType(apiToken, eventTypeUri) {
  const res = await axios.get(eventTypeUri, {
    headers: { Authorization: `Bearer ${apiToken}` },
    timeout: 8000,
  });
  return res.data.resource;
}

async function getAvailableTimes(apiToken, eventTypeUri, startTime, endTime) {
  try {
    const res = await axios.get(`${CALENDLY_API_BASE}/event_type_available_times`, {
      headers: { Authorization: `Bearer ${apiToken}` },
      params: { event_type: eventTypeUri, start_time: startTime, end_time: endTime },
      timeout: 10000,
    });
    return res.data.collection;
  } catch (err) {
    if (err.response?.data) {
      console.error('❌ Calendly error details:', JSON.stringify(err.response.data, null, 2));
    }
    throw err;
  }
}

// Returns the created invitee resource on success.
// Throws with err.calendlyPlanRequired = true if the account is on a free plan.
async function createInvitee(apiToken, { eventTypeUri, startTime, name, email, timezone }) {
  try {
    const res = await axios.post(`${CALENDLY_API_BASE}/invitees`, {
      event_type: eventTypeUri,
      start_time: startTime,
      invitee: { name, email, timezone },
    }, {
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      timeout: 10000,
    });
    return res.data.resource;
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || '';
    console.error(`❌ Calendly createInvitee failed (${status}): ${message}`);
    if (status === 402 || status === 403 || message.toLowerCase().includes('upgrade') || message.toLowerCase().includes('plan')) {
      const planErr = new Error('Calendly paid plan required');
      planErr.calendlyPlanRequired = true;
      throw planErr;
    }
    throw err;
  }
}

module.exports = { getUser, getEventTypes, getEventType, getAvailableTimes, createInvitee };
