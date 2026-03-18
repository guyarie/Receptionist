// Call Handler - Manages individual call sessions
const aiClient = require('./ai-client');
const callSummary = require('./call-summary');
const config = require('./config');
const { getPacificTimeISO } = require('./time-utils');
const { runPostCallAgent } = require('./agents/post-call-agent');

class CallHandler {
  constructor() {
    this.activeCalls = new Map(); // callSid -> call data
  }
  
  /**
   * Start a new call session
   */
  startCall(callSid, callerInfo = {}) {
    const sessionData = {
      callSid,
      from: callerInfo.from || 'Unknown',
      to: callerInfo.to || 'Unknown',
      startTime: getPacificTimeISO(),
      audioBuffer: []
    };
    
    this.activeCalls.set(callSid, sessionData);
    
    // Initialize AI session with caller phone number
    aiClient.initSession(callSid, { callerPhone: sessionData.from });
    
    console.log(`📞 Call started: ${callSid} from ${sessionData.from}`);
    
    return sessionData;
  }
  
  /**
   * Handle incoming audio chunk
   */
  handleAudio(streamSid, audioPayload) {
    const session = this.activeCalls.get(streamSid);
    if (!session) {
      console.warn(`⚠️ No session found for ${streamSid}`);
      return;
    }
    
    // Buffer audio chunks
    session.audioBuffer.push(audioPayload);
    
    // In a real implementation, we would:
    // 1. Accumulate audio until silence detected
    // 2. Convert μ-law to PCM
    // 3. Send to STT service
    // 4. Process with AI
    // 5. Convert response to speech
    // 6. Send back to caller
  }
  
  /**
   * Process text input (for testing or when using Gather)
   */
  async processText(callSid, text) {
    try {
      const response = await aiClient.sendMessage(callSid, text);
      return response;
    } catch (error) {
      console.error('❌ Error processing text:', error);
      return 'I apologize, but I\'m having trouble right now. Please try again.';
    }
  }
  
  /**
   * End call session and save summary
   */
  async endCall(callSid) {
    const session = this.activeCalls.get(callSid);
    if (session) {
      const conversationHistory = aiClient.getHistory(callSid);
      const callData = {
        callSid: session.callSid,
        from: session.from,
        to: session.to,
        startTime: session.startTime,
        endTime: getPacificTimeISO(),
        conversationHistory: conversationHistory
      };

      const mode = config.postCallAgentMode;

      if (mode === 'active') {
        // Agent replaces existing flow, with fallback
        try {
          await runPostCallAgent(callData);
          console.log(`📞 Call ended: ${callSid} - Agent summary saved`);
        } catch (error) {
          console.error(`❌ [${callSid}] Post-call agent failed, falling back to existing flow:`, error.message);
          try {
            await callSummary.saveCallSummary(callData);
            console.log(`📞 Call ended: ${callSid} - Fallback summary saved`);
          } catch (fallbackErr) {
            console.error('❌ Fallback summary also failed:', fallbackErr.message);
          }
        }
      } else {
        // 'disabled' — existing flow only
        try {
          await callSummary.saveCallSummary(callData);
          console.log(`📞 Call ended: ${callSid} - Summary saved`);
        } catch (error) {
          console.error('❌ Error saving call summary:', error);
        }
      }

      // Clean up
      aiClient.endSession(callSid);
      this.activeCalls.delete(callSid);
    }
  }
  
  /**
   * Get active call count
   */
  getActiveCallCount() {
    return this.activeCalls.size;
  }
}

module.exports = new CallHandler();
