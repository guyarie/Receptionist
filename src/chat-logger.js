// Chat Logger — saves web chat conversations to data/chat-logs/
const fs = require('fs');
const path = require('path');
const { getFilenameSafeTimestamp, getPacificTimeISO } = require('./time-utils');

const LOGS_DIR = path.join(__dirname, '..', 'data', 'chat-logs');

// Ensure directory exists
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// In-memory tracking of active chat sessions
const activeSessions = new Map();

/**
 * Log a chat exchange (user message + AI response)
 * Creates or appends to a session log file
 */
function logExchange(sessionId, userMessage, aiResponse, source = 'webchat') {
  try {
    let session = activeSessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        source,
        startTime: getPacificTimeISO(),
        messages: []
      };
      activeSessions.set(sessionId, session);
    }

    session.messages.push(
      { role: 'user', content: userMessage, time: getPacificTimeISO() },
      { role: 'assistant', content: aiResponse, time: getPacificTimeISO() }
    );

    // Write/overwrite the session file on each exchange
    const filename = `chat-${session.startTime.replace(/[T:]/g, '-')}-${sessionId.substring(0, 8)}.json`;
    const filepath = path.join(LOGS_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(session, null, 2));
  } catch (err) {
    console.error('❌ Chat log error:', err.message);
  }
}

/**
 * Get all chat logs, sorted by most recent first
 */
function getAllLogs() {
  try {
    const files = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.json'));
    return files.map(file => {
      const content = fs.readFileSync(path.join(LOGS_DIR, file), 'utf-8');
      return JSON.parse(content);
    }).sort((a, b) => b.startTime.localeCompare(a.startTime));
  } catch (err) {
    console.error('❌ Error reading chat logs:', err.message);
    return [];
  }
}

module.exports = { logExchange, getAllLogs };
