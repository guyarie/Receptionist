// OpenRouter AI Client
const OpenAI = require('openai');
const config = require('./config');
const prompts = require('./prompts');

class AIClient {
  constructor() {
    this.client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: config.openRouter.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Phone Receptionist'
      }
    });
    
    this.model = config.openRouter.model;
    this.conversationHistory = new Map(); // sessionId -> messages[]
    this.websiteContext = ''; // Will be set by server
    this.availabilityContext = ''; // Will be set by server
  }
  
  /**
   * Set website context (called by server on startup)
   */
  setWebsiteContext(context) {
    this.websiteContext = context;
    console.log('📚 Website context loaded into AI client');
  }
  
  /**
   * Set availability context (called by server on startup)
   */
  setAvailabilityContext(context) {
    this.availabilityContext = context;
    console.log('📅 Availability context loaded into AI client');
  }

  /**
   * Build the system prompt string (shared between session-based and stateless flows)
   * @param {Object} metadata - Optional metadata (e.g., callerPhone)
   * @returns {string}
   */
  buildSystemContent(metadata = {}) {
    let systemContent = prompts.systemPrompt;

    // Add caller information if available
    if (metadata.callerPhone) {
      systemContent += '\n\n' + '='.repeat(50);
      systemContent += '\nCALLER INFORMATION:\n';
      systemContent += '='.repeat(50);
      systemContent += `\n\nThe caller's phone number is: ${metadata.callerPhone}`;
      systemContent += '\nIf the caller asks for their callback number or the number they\'re calling from, you can provide this information.';
    }

    if (this.websiteContext) {
      systemContent += '\n\n' + '='.repeat(50);
      systemContent += '\nPRACTICE INFORMATION (use this to answer questions):\n';
      systemContent += '='.repeat(50);
      systemContent += '\n\n' + this.websiteContext;
    }

    // Add availability context after website context
    if (this.availabilityContext) {
      systemContent += '\n\n' + '='.repeat(50);
      systemContent += '\nPROVIDER AVAILABILITY (use this for scheduling questions):\n';
      systemContent += '='.repeat(50);
      systemContent += '\n\n' + this.availabilityContext;
    } else {
      systemContent += '\n\n' + '='.repeat(50);
      systemContent += '\nSCHEDULING INFORMATION:\n';
      systemContent += '='.repeat(50);
      systemContent += '\n\nSpecific scheduling information is not currently available. If callers ask about availability or scheduling, politely let them know they should call back or leave a message for the office to return their call with current availability.';
    }

    return systemContent;
  }
  
  /**
   * Initialize a new conversation session
   * @param {string} sessionId - Session identifier
   * @param {Object} metadata - Optional metadata (e.g., caller phone number)
   */
  initSession(sessionId, metadata = {}) {
    const systemPrompt = {
      role: 'system',
      content: this.buildSystemContent(metadata)
    };
    
    this.conversationHistory.set(sessionId, [systemPrompt]);
    console.log(`🤖 AI session initialized for ${sessionId}`);
  }
  
  /**
   * Send a message and get AI response (session-based, used for voice/internal flows)
   */
  async sendMessage(sessionId, userMessage) {
    if (!this.conversationHistory.has(sessionId)) {
      this.initSession(sessionId);
    }
    
    const messages = this.conversationHistory.get(sessionId);
    
    // Add user message to history
    messages.push({
      role: 'user',
      content: userMessage
    });
    
    try {
      console.log(`💬 User: ${userMessage}`);
      
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: messages,
        temperature: 0.7,
        max_tokens: 150 // Keep responses concise for phone calls
      });
      
      // Log the actual model used by OpenRouter
      if (response.model) {
        console.log(`🔍 Actual model used: ${response.model}`);
      }
      
      const assistantMessage = response.choices[0].message.content;
      
      // Add assistant response to history
      messages.push({
        role: 'assistant',
        content: assistantMessage
      });
      
      console.log(`🤖 AI: ${assistantMessage}`);
      
      return assistantMessage;
      
    } catch (error) {
      console.error('❌ OpenRouter API error:', error.message);
      throw error;
    }
  }

  /**
   * Stateless chat: accepts a full conversation history from the client,
   * prepends the system prompt, and returns only the assistant reply string.
   * No server-side session state is stored.
   *
   * @param {Array<{role: string, content: string}>} clientMessages - Full prior conversation
   * @returns {Promise<string>} - The assistant's reply text
   */
  async sendMessageWithHistory(clientMessages) {
    // Validate that clientMessages is a non-empty array
    if (!Array.isArray(clientMessages) || clientMessages.length === 0) {
      throw new Error('clientMessages must be a non-empty array');
    }

    // Build system prompt and prepend it to the client-supplied history
    const systemPrompt = {
      role: 'system',
      content: this.buildSystemContent()
    };

    const messages = [systemPrompt, ...clientMessages];

    console.log(`💬 [webchat] Sending ${clientMessages.length} message(s) to AI`);

    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 300 // Slightly more generous for web chat vs. phone
    });

    if (response.model) {
      console.log(`🔍 [webchat] Actual model used: ${response.model}`);
    }

    const assistantMessage = response.choices[0].message.content;
    console.log(`🤖 [webchat] AI: ${assistantMessage}`);

    return assistantMessage;
  }
  
  /**
   * Clean up session
   */
  endSession(sessionId) {
    this.conversationHistory.delete(sessionId);
    console.log(`🧹 AI session ended for ${sessionId}`);
  }
  
  /**
   * Get conversation history for a session
   */
  getHistory(sessionId) {
    return this.conversationHistory.get(sessionId) || [];
  }
}

module.exports = new AIClient();
