'use strict';

const { getEventType, getAvailableTimes } = require('./tools/calendly');
const { generateIcs } = require('./tools/ics');
const emailTransport = require('../email-transport');

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
        caller_email: {
          type: 'string',
          description: "Caller's email address, if provided. A calendar invite will be sent to this address.",
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
    process.env.CALENDLY_EVENT_TYPE_URI
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
  const { start_time, duration_minutes, caller_name, caller_email, notes } = args;
  const phone = args.caller_phone || callerPhone || '';
  const timezone = process.env.TIMEZONE || 'America/Los_Angeles';
  const businessName = process.env.BUSINESS_NAME || 'Your Practice';
  const practiceEmail = process.env.ADMIN_EMAIL || '';

  const durationMs = (duration_minutes || DEFAULT_DURATION_MIN) * 60 * 1000;
  const endTime = new Date(new Date(start_time).getTime() + durationMs).toISOString();
  const displayTime = formatSlotForSpeech(start_time, timezone);

  const description = [
    `Caller: ${caller_name}`,
    phone ? `Phone: ${phone}` : '',
    caller_email ? `Email: ${caller_email}` : '',
    notes ? `Notes: ${notes}` : '',
    'Booked via AI Receptionist',
  ].filter(Boolean).join('\n');

  const icsContent = generateIcs({
    uid: `${Date.now()}-${Math.random().toString(36).slice(2)}@receptionist`,
    startTime: start_time,
    endTime,
    summary: `Appointment — ${caller_name}`,
    description,
    organizerEmail: practiceEmail || undefined,
    attendeeEmail: caller_email || undefined,
  });

  const attachment = {
    filename: 'appointment.ics',
    content: Buffer.from(icsContent).toString('base64'),
  };

  const recipients = [practiceEmail, caller_email].filter(Boolean);

  if (recipients.length > 0 && emailTransport.isConfigured()) {
    const subject = `Appointment confirmed — ${caller_name} at ${displayTime}`;
    const body = [
      `Hi,`,
      ``,
      `An appointment has been booked via your AI Receptionist.`,
      ``,
      `Name: ${caller_name}`,
      phone ? `Phone: ${phone}` : '',
      caller_email ? `Email: ${caller_email}` : '',
      `Time: ${displayTime}`,
      notes ? `Notes: ${notes}` : '',
      ``,
      `A calendar invite is attached. Open it to add the appointment to your calendar.`,
      ``,
      `— ${businessName} AI Receptionist`,
    ].filter(l => l !== null).join('\n');

    await emailTransport.sendMail({ to: recipients, subject, body, attachments: [attachment] });
  }

  return {
    success: true,
    display_time: displayTime,
    invite_sent: recipients.length > 0 && emailTransport.isConfigured(),
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
