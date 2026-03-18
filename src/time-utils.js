// Time Utilities - Timezone-aware formatting
// Defaults to Pacific Time; override with TIMEZONE env var (e.g. America/New_York)

const TIMEZONE = process.env.TIMEZONE || 'America/Los_Angeles';

/**
 * Get current time in Pacific timezone as ISO-like string
 * Used for storing timestamps in call summaries and logs
 * @returns {string} ISO-like string in Pacific time (YYYY-MM-DDTHH:MM:SS format)
 */
function getPacificTimeISO() {
  const date = new Date();
  const pt = date.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Convert from "MM/DD/YYYY, HH:MM:SS" to "YYYY-MM-DDTHH:MM:SS"
  const [datePart, timePart] = pt.split(', ');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day}T${timePart}`;
}

/**
 * Format a date/timestamp for display in Pacific time
 * @param {string|Date} timestamp - ISO string or Date object
 * @returns {string} Formatted string in Pacific time
 */
function formatPacificTime(timestamp) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  return date.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Get current time formatted for filenames (no special characters)
 * @returns {string} Timestamp safe for filenames (YYYY-MM-DD-HH-MM-SS)
 */
function getFilenameSafeTimestamp() {
  const date = new Date();
  const pt = date.toLocaleString('en-US', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // Convert from "MM/DD/YYYY, HH:MM:SS" to "YYYY-MM-DD-HH-MM-SS"
  const [datePart, timePart] = pt.split(', ');
  const [month, day, year] = datePart.split('/');
  return `${year}-${month}-${day}-${timePart.replace(/:/g, '-')}`;
}

/**
 * Setup console.log to automatically prefix with Pacific time
 * Call this once at application startup
 */
function setupConsoleTimestamps() {
  const ptFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    const timestamp = ptFormatter.format(new Date()).replace(',', '');
    originalLog(`[${timestamp}]`, ...args);
  };

  console.error = (...args) => {
    const timestamp = ptFormatter.format(new Date()).replace(',', '');
    originalError(`[${timestamp}]`, ...args);
  };

  console.warn = (...args) => {
    const timestamp = ptFormatter.format(new Date()).replace(',', '');
    originalWarn(`[${timestamp}]`, ...args);
  };
}

module.exports = {
  getPacificTimeISO,
  formatPacificTime,
  getFilenameSafeTimestamp,
  setupConsoleTimestamps
};
