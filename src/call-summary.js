// Call Summary Manager - Logs call details and generates summaries
const fs = require('fs');
const path = require('path');
const aiClient = require('./ai-client');
const { getPacificTimeISO, getFilenameSafeTimestamp } = require('./time-utils');

class CallSummaryManager {
  constructor() {
    this.summariesDir = path.join(__dirname, '..', 'runtime', 'call-summaries');
    this.ensureDirectoryExists();
  }
  
  /**
   * Ensure summaries directory exists
   */
  ensureDirectoryExists() {
    if (!fs.existsSync(this.summariesDir)) {
      fs.mkdirSync(this.summariesDir, { recursive: true });
      console.log('📁 Created call-summaries directory');
    }
  }
  
  /**
   * Generate AI summary of the conversation
   */
  async generateSummary(conversationHistory) {
    try {
      // Extract just the user and assistant messages (skip system prompt)
      const messages = conversationHistory.filter(msg => 
        msg.role === 'user' || msg.role === 'assistant'
      );
      
      if (messages.length === 0) {
        return 'No conversation occurred.';
      }
      
      // Create a summary prompt
      const summaryPrompt = `Please provide a brief summary of this phone conversation. Include:
1. What the caller was looking for
2. What information was provided
3. Any specific clinicians mentioned
4. Next steps or action items

Keep it concise (3-4 sentences max).

Conversation:
${messages.map(m => `${m.role === 'user' ? 'Caller' : 'Receptionist'}: ${m.content}`).join('\n')}`;
      
      const response = await aiClient.client.chat.completions.create({
        model: aiClient.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes phone conversations.' },
          { role: 'user', content: summaryPrompt }
        ],
        temperature: 0.3,
        max_tokens: 200
      });
      
      return response.choices[0].message.content;
      
    } catch (error) {
      console.error('❌ Error generating summary:', error.message);
      return 'Error generating summary.';
    }
  }
  
  /**
   * Save call summary to file
   */
  async saveCallSummary(callData) {
    try {
      const {
        callSid,
        from,
        to,
        startTime,
        endTime,
        conversationHistory
      } = callData;
      
      // Generate AI summary
      const aiSummary = await this.generateSummary(conversationHistory);
      
      // Format the summary
      const summary = {
        callSid: callSid,
        callerPhone: from,
        twilioNumber: to,
        startTime: startTime,
        endTime: endTime,
        duration: endTime ? Math.round((new Date(endTime) - new Date(startTime)) / 1000) + ' seconds' : 'Unknown',
        summary: aiSummary,
        fullTranscript: conversationHistory
          .filter(msg => msg.role === 'user' || msg.role === 'assistant')
          .map(msg => ({
            speaker: msg.role === 'user' ? 'Caller' : 'AI Receptionist',
            message: msg.content
          }))
      };
      
      // Create filename with timestamp (Pacific time)
      const timestamp = getFilenameSafeTimestamp();
      const filename = `call-${timestamp}-${callSid ? callSid.substring(0, 8) : 'unknown'}.json`;
      const filepath = path.join(this.summariesDir, filename);
      
      // Save to file
      fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
      
      console.log(`📝 Call summary saved: ${filename}`);
      
      return filepath;
      
    } catch (error) {
      console.error('❌ Error saving call summary:', error.message);
      throw error;
    }
  }
  
  /**
   * Save a pre-built summary object directly to disk.
   * Used by the post-call agent's save_call_summary tool.
   * @param {Object} summaryData - Pre-built summary with callSid, callerPhone, twilioNumber, startTime, endTime, duration, summary, fullTranscript
   * @returns {string} filepath of the saved summary
   */
  saveSummaryDirect(summaryData) {
    this.ensureDirectoryExists();

    const { callSid, callerPhone, twilioNumber, startTime, endTime, duration, summary, notificationDecision, fullTranscript } = summaryData;

    const summaryObj = { callSid, callerPhone, twilioNumber, startTime, endTime, duration, summary, fullTranscript };
    if (notificationDecision) {
      summaryObj.notificationDecision = notificationDecision;
    }

    const timestamp = getFilenameSafeTimestamp();
    const shortSid = callSid ? callSid.substring(0, 8) : 'unknown';
    const filename = `call-${timestamp}-${shortSid}.json`;
    const filepath = path.join(this.summariesDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(summaryObj, null, 2));
    console.log(`📝 Call summary saved (direct): ${filename}`);

    return filepath;
  }

  /**
   * Get all call summaries
   */
  getAllSummaries() {
    try {
      const files = fs.readdirSync(this.summariesDir)
        .filter(file => file.endsWith('.json'));
      
      // Load all summaries and sort by actual startTime (most recent first)
      return files.map(file => {
        const filepath = path.join(this.summariesDir, file);
        const content = fs.readFileSync(filepath, 'utf-8');
        return JSON.parse(content);
      }).sort((a, b) => {
        // Sort by startTime descending (most recent first)
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return timeB - timeA;
      });
      
    } catch (error) {
      console.error('❌ Error reading summaries:', error.message);
      return [];
    }
  }
  
  /**
   * Get paginated call summaries
   * @param {number} page - Page number (1-indexed)
   * @param {number} limit - Number of items per page
   * @returns {Object} { calls, total, page, totalPages }
   */
  getSummariesPaginated(page = 1, limit = 20) {
    try {
      const files = fs.readdirSync(this.summariesDir)
        .filter(file => file.endsWith('.json'));
      
      // Load all summaries and sort by actual startTime (most recent first)
      const summaries = files.map(file => {
        const filepath = path.join(this.summariesDir, file);
        const content = fs.readFileSync(filepath, 'utf-8');
        const summary = JSON.parse(content);
        return {
          id: file.replace('.json', ''),
          filename: file,
          ...summary
        };
      }).sort((a, b) => {
        // Sort by startTime descending (most recent first)
        const timeA = new Date(a.startTime).getTime();
        const timeB = new Date(b.startTime).getTime();
        return timeB - timeA;
      });
      
      const total = summaries.length;
      const totalPages = Math.ceil(total / limit);
      const validPage = Math.max(1, Math.min(page, totalPages || 1));
      
      const startIndex = (validPage - 1) * limit;
      const endIndex = startIndex + limit;
      const calls = summaries.slice(startIndex, endIndex);
      
      return {
        calls,
        total,
        page: validPage,
        totalPages: totalPages || 1
      };
      
    } catch (error) {
      console.error('❌ Error reading paginated summaries:', error.message);
      return {
        calls: [],
        total: 0,
        page: 1,
        totalPages: 1
      };
    }
  }
  
  /**
   * Get a single call summary by ID (filename without extension)
   * @param {string} id - The call summary ID (filename without .json)
   * @returns {Object|null} Call summary object or null if not found
   */
  getSummaryById(id) {
    try {
      // Sanitize the id to prevent directory traversal
      const sanitizedId = path.basename(id);
      const filename = sanitizedId.endsWith('.json') ? sanitizedId : `${sanitizedId}.json`;
      const filepath = path.join(this.summariesDir, filename);
      
      if (!fs.existsSync(filepath)) {
        console.log(`⚠️ Call summary not found: ${id}`);
        return null;
      }
      
      const content = fs.readFileSync(filepath, 'utf-8');
      const summary = JSON.parse(content);
      
      return {
        id: sanitizedId.replace('.json', ''),
        ...summary
      };
      
    } catch (error) {
      console.error('❌ Error reading summary by ID:', error.message);
      return null;
    }
  }

  /**
   * Delete a single call summary by ID
   * @param {string} id - Call summary ID (filename without .json)
   * @returns {boolean} true if deleted, false if not found
   */
  deleteSummaryById(id) {
    const sanitizedId = path.basename(id);
    const filename = sanitizedId.endsWith('.json') ? sanitizedId : `${sanitizedId}.json`;
    const filepath = path.join(this.summariesDir, filename);

    if (!fs.existsSync(filepath)) {
      return false;
    }

    fs.unlinkSync(filepath);
    return true;
  }

  /**
   * Delete all call summary JSON files
   * @returns {number} count of deleted files
   */
  deleteAllSummaries() {
    const files = fs.readdirSync(this.summariesDir)
      .filter(file => file.endsWith('.json'));

    for (const file of files) {
      fs.unlinkSync(path.join(this.summariesDir, file));
    }

    return files.length;
  }

}

module.exports = new CallSummaryManager();
