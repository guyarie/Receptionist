// Fixture loader and validator for the simulated call bank
// Reads, validates, and returns call fixture JSON files for post-call agent testing

const fs = require('fs');
const path = require('path');

const CALL_BANK_DIR = __dirname;

const REQUIRED_FIELDS = ['callSid', 'from', 'to', 'startTime', 'endTime', 'conversationHistory'];

/**
 * Validates a call fixture has all required fields and correct structure.
 * Throws an error identifying the filename and missing/invalid field.
 * @param {object} data - The fixture data to validate
 * @param {string} filename - The fixture filename (used in error messages)
 */
function validateFixture(data, filename) {
  for (const field of REQUIRED_FIELDS) {
    if (data[field] === undefined || data[field] === null) {
      throw new Error(`Fixture "${filename}" is missing required field: ${field}`);
    }
  }

  if (!Array.isArray(data.conversationHistory)) {
    throw new Error(`Fixture "${filename}" has invalid field: conversationHistory must be an array`);
  }

  for (let i = 0; i < data.conversationHistory.length; i++) {
    const entry = data.conversationHistory[i];
    if (!entry || typeof entry.role !== 'string') {
      throw new Error(`Fixture "${filename}" has invalid conversationHistory[${i}]: missing role`);
    }
    if (!entry || typeof entry.content !== 'string') {
      throw new Error(`Fixture "${filename}" has invalid conversationHistory[${i}]: missing content`);
    }
  }
}

/**
 * Loads all .json fixture files from the call bank directory.
 * Returns an empty array if the directory is empty or missing.
 * @returns {Array<{filename: string, data: object}>}
 */
function loadAllFixtures() {
  if (!fs.existsSync(CALL_BANK_DIR)) {
    return [];
  }

  const files = fs.readdirSync(CALL_BANK_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    return [];
  }

  return files.map(filename => {
    const filepath = path.join(CALL_BANK_DIR, filename);
    const raw = fs.readFileSync(filepath, 'utf-8');
    const data = JSON.parse(raw);
    validateFixture(data, filename);
    return { filename, data };
  });
}

/**
 * Loads a single fixture by filename.
 * @param {string} filename - The fixture filename to load
 * @returns {{filename: string, data: object}}
 * @throws {Error} If the file doesn't exist or fails validation
 */
function loadFixture(filename) {
  const filepath = path.join(CALL_BANK_DIR, filename);
  if (!fs.existsSync(filepath)) {
    throw new Error(`Fixture file not found: ${filename}`);
  }

  const raw = fs.readFileSync(filepath, 'utf-8');
  const data = JSON.parse(raw);
  validateFixture(data, filename);
  return { filename, data };
}

module.exports = { loadAllFixtures, loadFixture, validateFixture };
