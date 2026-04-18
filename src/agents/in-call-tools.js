'use strict';

const { getEventType, getAvailableTimes } = require('./tools/calendly');
const { refreshAccessToken, createCalendarEvent } = require('./tools/google-calendar');

const DEFAULT_DURATION_MIN = 30;
// Calendly available_times endpoint supports max 14 days per request
const MAX_DAYS_AHEAD = 14;

// Tool definitions in OpenAI Realtime API format (not Vercel AI SDK format)
const SCHEDULING_TOOLS = [
  {
    type: 'function',
    name: 'check_availability',
    description: 'Check available appointment slots. Use this when a caller asks about scheduling, availability, or wants to book an appointment. Returns a list of open times the caller can choose from.',
    parameters: {
      type: 'object',
      properties: {
        days_ahead: {
          type: 'number',
          description: 'How many days ahead to check (default 5, max 14).',
        },
      },
    },
  },
  {
    type: 'function',
    name: 'book_appointment',
    description: 'Book an appointment at a specific time the caller has confirmed. Only call this after the caller has explicitly chosen a slot from the availability list.',
    parameters: {
      type: 'object',
      properties: {
        start_time: {
          type: 'string',
          description: 'ISO 8601 start time of the appointment, e.g. 2024-01-15T14:00:00Z',
        },
        duration_minutes: {
          type: 'number',
          description: 'Duration in minutes (use what was returned by check_availability).',
        },
        caller_name: {
          type: 'string',
          description: "Caller's full name.",
        },
        caller_phone: {
          type: 'string',
          description: "Caller's phone number.",
        },
        notes: {
          type: 'string',
          description: 'Optional reason for the appointment or other notes.',
        },
      },
      required: ['start_time', 'caller_name'],
    },
  },
];

function isSchedulingEnabled() {
  return !!(
    process.env.CALENDLY_API_TOKEN &&
    process.env.CALENDLY_EVENT_TYPE_URI &&
    process.env.GCAL_CLIENT_ID &&
    process.env.GCAL_CLIENT_SECRET &&
    process.env.GCAL_REFRESH_TOKEN
  );
}

function formatSlotForSpeech(isoTime, timezone) {
  return new Date(isoTime).toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

async function executeCheckAvailability(args) {
  const daysAhead = Math.min(args.days_ahead || 5, MAX_DAYS_AHEAD);
  const apiToken = process.env.CALENDLY_API_TOKEN;
  const eventTypeUri = process.env.CALENDLY_EVENT_TYPE_URI;
  const timezone = process.env.TIMEZONE || 'America/Los_Angeles';

  if (!apiToken || !eventTypeUri) {
    return { error: 'Scheduling is not configured for this practice.' };
  }

  const startTime = new Date().toISOString();
  const endTime = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();

  const slots = await getAvailableTimes(apiToken, eventTypeUri, startTime, endTime);
  const available = slots.filter(s => s.status === 'available' && s.invitees_remaining > 0);

  if (available.length === 0) {
    return { message: `No available slots in the next ${daysAhead} days. The caller may want to call back later or leave a message.` };
  }

  let durationMinutes = DEFAULT_DURATION_MIN;
  try {
    const eventType = await getEventType(apiToken, eventTypeUri);
    durationMinutes = eventType.duration || DEFAULT_DURATION_MIN;
  } catch (_) {}

  const top = available.slice(0, 8);
  return {
    available_slots: top.map(s => ({
      start_time: s.start_time,
      display: formatSlotForSpeech(s.start_time, timezone),
      duration_minutes: durationMinutes,
    })),
    total_found: available.length,
    note: 'Present these options to the caller. Once they choose one, call book_appointment.',
  };
}

async function executeBookAppointment(args, callerPhone) {
  const { start_time, duration_minutes, caller_name, notes } = args;
  const phone = args.caller_phone || callerPhone || '';

  const clientId = process.env.GCAL_CLIENT_ID;
  const clientSecret = process.env.GCAL_CLIENT_SECRET;
  const refreshToken = process.env.GCAL_REFRESH_TOKEN;
  const calendarId = process.env.GCAL_CALENDAR_ID || 'primary';
  const timezone = process.env.TIMEZONE || 'America/Los_Angeles';

  if (!clientId || !clientSecret || !refreshToken) {
    return { error: 'Calendar booking is not configured for this practice.' };
  }

  const accessToken = await refreshAccessToken(clientId, clientSecret, refreshToken);

  const durationMs = (duration_minutes || DEFAULT_DURATION_MIN) * 60 * 1000;
  const endTime = new Date(new Date(start_time).getTime() + durationMs).toISOString();

  const event = {
    summary: `Appointment — ${caller_name}`,
    description: [
      `Caller: ${caller_name}`,
      phone ? `Phone: ${phone}` : '',
      notes ? `Notes: ${notes}` : '',
      'Booked via AI Receptionist',
    ].filter(Boolean).join('\n'),
    start: { dateTime: start_time, timeZone: timezone },
    end: { dateTime: endTime, timeZone: timezone },
  };

  const created = await createCalendarEvent(accessToken, calendarId, event);

  return {
    success: true,
    event_id: created.id,
    display_time: formatSlotForSpeech(start_time, timezone),
    calendar_link: created.htmlLink,
  };
}

async function executeTool(name, args, callerPhone) {
  switch (name) {
    case 'check_availability':
      return executeCheckAvailability(args);
    case 'book_appointment':
      return executeBookAppointment(args, callerPhone);
    default:
      return { error: `Unknown scheduling tool: ${name}` };
  }
}

module.exports = { SCHEDULING_TOOLS, isSchedulingEnabled, executeTool };
