'use strict';

const { getEventType, getAvailableTimes, createInvitee } = require('./tools/calendly');
const { generateIcs } = require('./tools/ics');
const emailTransport = require('../email-transport');
const providerLoader = require('../provider-loader');

const DEFAULT_DURATION_MIN = 30;
// Calendly available_times endpoint supports max 7 days per request
const MAX_DAYS_AHEAD = 7;

const PROVIDER_INFO_TOOL = {
  type: 'function',
  name: 'get_provider_info',
  description: 'Get the full profile for a specific provider. Call this whenever a caller asks about a specific therapist or clinician by name — their specialties, fees, insurance, credentials, approach, or scheduling process. A partial name (e.g. "Dr. Arie", "Miri") is fine.',
  parameters: {
    type: 'object',
    properties: {
      provider_name: {
        type: 'string',
        description: "The provider's name as the caller said it. Partial names are fine (e.g. 'Dr. Arie', 'Miri', 'Jeffrey').",
      },
    },
    required: ['provider_name'],
  },
};

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

function isForwardingEnabled() {
  return !!(
    process.env.FORWARD_NUMBER &&
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN
  );
}

const FORWARD_TOOL = {
  type: 'function',
  name: 'forward_call',
  description: 'Forward the current call to the configured number. Use this when the caller asks to speak to a person, needs to be transferred, or the situation requires human assistance.',
  parameters: { type: 'object', properties: {} },
};

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

  const startTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
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

  // Try Calendly direct booking first (requires paid plan)
  const apiToken = process.env.CALENDLY_API_TOKEN;
  const eventTypeUri = process.env.CALENDLY_EVENT_TYPE_URI;
  if (apiToken && eventTypeUri && caller_email) {
    try {
      await createInvitee(apiToken, {
        eventTypeUri,
        startTime: start_time,
        name: caller_name,
        email: caller_email,
        timezone,
      });
      console.log(`📅 Calendly invitee created for ${caller_name} at ${start_time}`);
      return {
        success: true,
        display_time: formatSlotForSpeech(start_time, timezone),
        invite_sent: true,
        method: 'calendly',
      };
    } catch (err) {
      if (err.calendlyPlanRequired) {
        console.log('📅 Calendly paid plan not available — falling back to ICS email');
      } else {
        console.error('📅 Calendly booking failed — falling back to ICS email:', err.message);
      }
    }
  }

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

    // Build Google Calendar and Outlook links
    const toGcalDate = iso => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE` +
      `&text=${encodeURIComponent(`Appointment — ${caller_name}`)}` +
      `&dates=${toGcalDate(start_time)}/${toGcalDate(endTime)}` +
      `&details=${encodeURIComponent(description)}`;
    const outlookUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(`Appointment — ${caller_name}`)}` +
      `&startdt=${start_time}&enddt=${endTime}&body=${encodeURIComponent(description)}`;

    const detailLines = [
      `<b>Name:</b> ${caller_name}`,
      phone ? `<b>Phone:</b> ${phone}` : null,
      caller_email ? `<b>Email:</b> ${caller_email}` : null,
      `<b>Time:</b> ${displayTime}`,
      notes ? `<b>Notes:</b> ${notes}` : null,
    ].filter(Boolean).join('<br>');

    const html = `
<div style="font-family:sans-serif;font-size:15px;color:#333;max-width:520px">
  <p>An appointment has been booked via your AI Receptionist.</p>
  <p style="line-height:1.8">${detailLines}</p>
  <p>
    <a href="${gcalUrl}" style="display:inline-block;margin-right:12px;padding:10px 18px;background:#4285F4;color:white;border-radius:5px;text-decoration:none;font-weight:bold">Add to Google Calendar</a>
    <a href="${outlookUrl}" style="display:inline-block;padding:10px 18px;background:#0072C6;color:white;border-radius:5px;text-decoration:none;font-weight:bold">Add to Outlook</a>
  </p>
  <p style="color:#888;font-size:13px">An .ics file is also attached for Apple Calendar or other calendar apps.</p>
  <p style="color:#aaa;font-size:12px">— ${businessName} AI Receptionist</p>
</div>`;

    const body = `An appointment has been booked via your AI Receptionist.\n\nName: ${caller_name}\n${phone ? `Phone: ${phone}\n` : ''}${caller_email ? `Email: ${caller_email}\n` : ''}Time: ${displayTime}\n${notes ? `Notes: ${notes}\n` : ''}\nAdd to Google Calendar: ${gcalUrl}\nAdd to Outlook: ${outlookUrl}\n\n— ${businessName} AI Receptionist`;

    await emailTransport.sendMail({ to: recipients, subject, body, html, attachments: [attachment] });
  }

  return {
    success: true,
    display_time: displayTime,
    invite_sent: recipients.length > 0 && emailTransport.isConfigured(),
  };
}

function executeGetProviderInfo(args) {
  const { provider_name } = args;
  if (!provider_name) return { error: 'provider_name is required' };

  const match = providerLoader.findByName(provider_name);
  if (!match) {
    return {
      error: `No provider found matching "${provider_name}". Check the roster in your instructions for available names.`,
    };
  }

  return { provider: match.name, profile: match.content };
}

async function executeForwardCall(callSid) {
  const forwardNumber = process.env.FORWARD_NUMBER;
  if (!forwardNumber) return { error: 'FORWARD_NUMBER is not configured' };
  if (!callSid) return { error: 'Call SID unavailable — cannot forward' };

  const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  try {
    await twilio.calls(callSid).update({
      twiml: `<Response><Dial>${forwardNumber}</Dial></Response>`
    });
    console.log(`📲 Call ${callSid} forwarded to ${forwardNumber}`);
    return { success: true, forwarded_to: forwardNumber };
  } catch (err) {
    console.error(`❌ Failed to forward call ${callSid}:`, err.message);
    return { error: `Failed to forward call: ${err.message}` };
  }
}

async function executeTool(name, args, callerPhone, callSid) {
  switch (name) {
    case 'get_provider_info':
      return executeGetProviderInfo(args);
    case 'check_availability':
      return executeCheckAvailability(args);
    case 'book_appointment':
      return executeBookAppointment(args, callerPhone);
    case 'forward_call':
      return executeForwardCall(callSid);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

module.exports = { PROVIDER_INFO_TOOL, SCHEDULING_TOOLS, FORWARD_TOOL, isSchedulingEnabled, isForwardingEnabled, executeTool };
