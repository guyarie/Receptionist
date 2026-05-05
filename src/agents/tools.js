// Shared tool definitions for AI agents
// Each tool is a thin adapter wrapping an existing module
// Uses inputSchema (AI SDK v6 name) + jsonSchema() to bypass broken Zod v4 schema generation
const { tool, jsonSchema } = require('ai');
const callSummaryManager = require('../call-summary');
const providerLoader = require('../provider-loader');
const emailTransport = require('../email-transport');

function createTools(options = {}) {
  const tools = {
    save_call_summary: tool({
      description: 'Save a call summary to disk as a JSON file',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          callSid: { type: 'string' },
          callerPhone: { type: 'string' },
          twilioNumber: { type: 'string' },
          startTime: { type: 'string' },
          endTime: { type: 'string' },
          duration: { type: 'string' },
          summary: { type: 'string' },
          fullTranscript: { type: 'string', description: 'Full conversation as plain text, one line per turn, e.g. "Caller: Hi\\nAI Receptionist: Hello..."' },
          notificationDecision: { type: 'string', description: 'Brief explanation of whether a notification was sent and why' }
        },
        required: ['callSid', 'callerPhone', 'twilioNumber', 'startTime', 'endTime', 'duration', 'summary', 'fullTranscript']
      }),
      execute: async (params) => {
        console.log(`[post-call] save_call_summary args:`, JSON.stringify(params).substring(0, 300));
        if (!params.callSid && !params.callerPhone) {
          console.error('[post-call] save_call_summary called with empty args — model did not pass tool arguments');
          return { success: false, error: 'Tool called with no arguments — model compatibility issue' };
        }
        const filepath = callSummaryManager.saveSummaryDirect(params);
        return { success: true, filepath };
      }
    }),

    read_provider_profiles: tool({
      description: 'Read compact provider profiles: name, email, specialties, insurance accepted',
      inputSchema: jsonSchema({ type: 'object', properties: {} }),
      execute: async () => {
        const allProfiles = providerLoader.getAll();
        // Extract compact info from each markdown profile to keep token count low
        const compact = {};
        for (const [filename, content] of Object.entries(allProfiles)) {
          const name = (content.match(/^#\s+(.+)/m) || [])[1] || filename.replace('.md', '');
          const email = (content.match(/\*\*Email:\*\*\s*(.+)/i) || [])[1] || 'not listed';
          const phone = (content.match(/\*\*Phone:\*\*\s*(.+)/i) || [])[1] || 'not listed';

          // Extract areas of focus / specialties section
          const focusMatch = content.match(/## Areas of Focus\n([\s\S]*?)(?=\n##|\n$|$)/);
          const specialties = focusMatch
            ? focusMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim()).join(', ')
            : '';

          // Extract insurance section if present
          const insuranceMatch = content.match(/## Insurance.*?\n([\s\S]*?)(?=\n##|\n$|$)/i);
          const insurance = insuranceMatch
            ? insuranceMatch[1].split('\n').filter(l => l.startsWith('- ')).map(l => l.replace(/^- /, '').trim()).join(', ')
            : 'not listed';

          compact[filename] = { name, email, phone, specialties, insurance };
        }
        return compact;
      }
    }),

    read_call_summaries: tool({
      description: 'Read call summaries, optionally filtered by date',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          date: { type: 'string', description: 'ISO date string (YYYY-MM-DD) to filter summaries' }
        }
      }),
      execute: async ({ date }) => {
        const summaries = callSummaryManager.getAllSummaries();
        if (date) {
          return summaries.filter(s => s.startTime && s.startTime.startsWith(date));
        }
        return summaries;
      }
    }),

    send_email: tool({
      description: 'Send an email to a recipient',
      inputSchema: jsonSchema({
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient email address' },
          subject: { type: 'string', description: 'Email subject line' },
          body: { type: 'string', description: 'Email body text' }
        },
        required: ['to', 'subject', 'body']
      }),
      execute: async ({ to, subject, body }) => {
        if (!to || to.trim() === '') {
          return { success: false, error: 'Recipient email address is missing or empty' };
        }
        if (!emailTransport.isConfigured()) {
          return { success: false, error: 'Email is not configured (SMTP settings missing)' };
        }
        try {
          await emailTransport.sendMail({ to, subject, body });
          return { success: true };
        } catch (err) {
          return { success: false, error: `Failed to send email: ${err.message}` };
        }
      }
    })
  };

  return tools;
}

module.exports = { createTools };
