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
  const res = await axios.get(`${CALENDLY_API_BASE}/event_type_available_times`, {
    headers: { Authorization: `Bearer ${apiToken}` },
    params: { event_type: eventTypeUri, start_time: startTime, end_time: endTime },
    timeout: 10000,
  });
  return res.data.collection;
}

module.exports = { getUser, getEventTypes, getEventType, getAvailableTimes };
