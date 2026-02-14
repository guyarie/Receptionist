'use strict';

const callSummary = require('../call-summary');
const errorBuffer = require('../error-buffer');

/**
 * Relay Service - Bridges a Twilio Media Stream WebSocket and a Provider Adapter
 * for a single call session. Manages audio relay, transcript capture, interruption
 * handling, and session cleanup.
 */
class RelayService {
  /**
   * @param {WebSocket} twilioWs - Twilio Media Stream WebSocket connection
   * @param {ProviderAdapter} providerAdapter - AI provider adapter instance
   * @param {string} callSid - Twilio Call SID
   * @param {string} streamSid - Twilio Stream SID
   * @param {Object} callerInfo - Caller information
   * @param {string} callerInfo.from - Caller phone number
   * @param {string} callerInfo.to - Called phone number
   */
  constructor(twilioWs, providerAdapter, callSid, streamSid, callerInfo) {
    this.twilioWs = twilioWs;
    this.provider = providerAdapter;
    this.callSid = callSid;
    this.streamSid = streamSid;
    this.callerInfo = callerInfo || {};
    this.conversationHistory = [];
    this.closed = false;
    this.startTime = new Date().toISOString();
    this.sessionManager = null;
    this.errors = [];
  }

  /**
   * Initialize the relay by wiring provider callbacks and connecting.
   * @param {Object} options
   * @param {string} options.systemPrompt - System instructions
   * @param {string} options.websiteContext - Scraped website content
   * @param {string} options.availabilityContext - Provider availability info
   */
  async initialize(options) {
    this.provider.onAudioOutput = (audio) => this.sendAudioToTwilio(audio);
    this.provider.onTranscript = (role, text) => this.addTranscript(role, text);
    this.provider.onSpeechStarted = () => this.handleInterruption();
    this.provider.onError = (err) => this.handleProviderError(err);
    this.provider.onClose = () => this.handleProviderClose();

    await this.provider.connect(options);
  }

  /**
   * Forward Twilio media audio to the provider adapter.
   * @param {string} audioPayload - Base64-encoded mulaw audio
   */
  handleTwilioMedia(audioPayload) {
    this.provider.sendAudio(audioPayload);
  }

  /**
   * Send audio back to the caller via the Twilio WebSocket.
   * @param {string} audio - Base64-encoded audio data
   */
  sendAudioToTwilio(audio) {
    if (this.twilioWs.readyState === 1) {
      this.twilioWs.send(JSON.stringify({
        event: 'media',
        streamSid: this.streamSid,
        media: { payload: audio }
      }));
    }
  }

  /**
   * Handle caller interruption — clear Twilio playback and cancel provider response.
   */
  handleInterruption() {
    if (this.twilioWs.readyState === 1) {
      this.twilioWs.send(JSON.stringify({
        event: 'clear',
        streamSid: this.streamSid
      }));
    }
    this.provider.cancelResponse();
  }

  /**
   * Store a transcript entry in the conversation history.
   * @param {string} role - 'caller' or 'assistant'
   * @param {string} text - Transcript text
   */
  addTranscript(role, text) {
    this.conversationHistory.push({ role, text });
  }

  /**
   * Handle a provider-side error. Logs and stores for later reporting.
   * @param {Error} err - The error from the provider
   */
  handleProviderError(err) {
    console.error(`❌ [${this.callSid}] Provider error:`, err.message || err);
    this.errors.push(err);
  }

  /**
   * Handle provider connection closing. Closes Twilio WS and triggers cleanup.
   */
  handleProviderClose() {
    if (this.twilioWs.readyState === 1) {
      this.twilioWs.close();
    }
    this.cleanup();
  }

  /**
   * Idempotent cleanup — closes provider, generates call summary,
   * removes session, and reports errors.
   */
  async cleanup() {
    if (this.closed) return;
    this.closed = true;

    // Close the provider connection
    try {
      this.provider.close();
    } catch (err) {
      console.error(`❌ [${this.callSid}] Error closing provider:`, err.message);
    }

    // Generate call summary
    try {
      const formattedHistory = this.conversationHistory.map(entry => ({
        role: entry.role === 'caller' ? 'user' : 'assistant',
        content: entry.text
      }));

      await callSummary.saveCallSummary({
        callSid: this.callSid,
        from: this.callerInfo.from,
        to: this.callerInfo.to,
        startTime: this.startTime,
        endTime: new Date().toISOString(),
        conversationHistory: formattedHistory
      });
    } catch (err) {
      console.error(`❌ [${this.callSid}] Error saving call summary:`, err.message);
    }

    // Remove session from session manager
    if (this.sessionManager) {
      this.sessionManager.removeSession(this.streamSid);
    }

    // Add accumulated errors to the error buffer
    for (const err of this.errors) {
      errorBuffer.add(err, `streaming-call:${this.callSid}`);
    }
  }
}

module.exports = RelayService;
