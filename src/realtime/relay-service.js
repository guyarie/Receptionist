'use strict';

const callSummary = require('../call-summary');
const config = require('../config');
const errorBuffer = require('../error-buffer');
const { getPacificTimeISO } = require('../time-utils');
const { runPostCallAgent } = require('../agents/post-call-agent');

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
    providerAdapter.callSid = callSid;
    this.callerInfo = callerInfo || {};
    this.conversationHistory = [];
    this.closed = false;
    this.startTime = getPacificTimeISO();
    this.sessionManager = null;
    this.errors = [];
    this.keepaliveInterval = null;
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
    this.provider.onHangup = () => this.handleHangup();
    this.provider.onHangupRequested = (callId) => this.handleHangupRequested(callId);
    this.provider.onTextOnlyRefusal = () => this.handleTextOnlyRefusal();

    await this.provider.connect(options);

    // Start keepalive mechanism after initialization completes
    this._startKeepalive();
  }

  /**
   * Start sending periodic keepalive messages to prevent WebSocket timeout.
   * Sends a Twilio mark event every 30 seconds.
   * @private
   */
  _startKeepalive() {
    this.keepaliveInterval = setInterval(() => {
      try {
        // Check WebSocket readyState before sending
        if (this.twilioWs.readyState === 1) {
          this.twilioWs.send(JSON.stringify({
            event: 'mark',
            streamSid: this.streamSid,
            mark: { name: 'keepalive' }
          }));
          console.log(`🔄 [${this.callSid}] Keepalive ping sent`);
        }
      } catch (err) {
        // Don't propagate keepalive errors to main error handler
        console.log(`⚠️ [${this.callSid}] Keepalive ping failed:`, err.message);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop the keepalive timer.
   * @private
   */
  _stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
    }
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
   * Handle AI-initiated hangup. Closes the Twilio WebSocket, which causes
   * Twilio to end the call naturally without needing REST API credentials.
   */
  handleHangup() {
    console.log(`👋 [${this.callSid}] AI ended the call`);
    if (this.twilioWs.readyState === 1) {
      this.twilioWs.close();
    }
  }

  handleHangupRequested(callId) {
    if (!this.hangupConfirmed) {
      this.hangupConfirmed = true;
      console.log(`📵 [${this.callSid}] Hangup requested — asking AI to confirm with caller`);
      this.provider.sendFunctionResult(callId, {
        status: 'pending_confirmation',
        instruction: 'Before ending the call, ask the caller if there is anything else you can help them with. Only call hangup again once they confirm they are done.',
      });
    } else {
      console.log(`👋 [${this.callSid}] Hangup confirmed — ending call`);
      this.handleHangup();
    }
  }

  /**
   * Handle a text-only (refusal) response from the provider — play a TTS fallback
   * message via Twilio REST API and end the call, rather than leaving the relay open.
   */
  handleTextOnlyRefusal() {
    console.error(`🚨 [${this.callSid}] Provider returned text-only response — playing fallback message and ending call`);
    this.errors.push(new Error('Provider returned text-only response (possible refusal or oversized instructions)'));

    const { accountSid, authToken } = config.twilio;
    if (accountSid && authToken) {
      const twilioClient = require('twilio')(accountSid, authToken);
      const twiml = `<Response><Say>I'm sorry, I'm having some trouble right now. Please try calling back in a few minutes.</Say><Hangup/></Response>`;
      twilioClient.calls(this.callSid).update({ twiml }).catch((err) => {
        console.error(`❌ [${this.callSid}] Failed to play fallback message:`, err.message);
        if (this.twilioWs.readyState === 1) this.twilioWs.close();
      });
    } else {
      if (this.twilioWs.readyState === 1) this.twilioWs.close();
    }
  }

  /**
   * Idempotent cleanup — closes provider, generates call summary,
   * removes session, and reports errors.
   */
  async cleanup() {
    if (this.closed) return;
    this.closed = true;

    // Stop keepalive timer
    this._stopKeepalive();

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

      const callData = {
        callSid: this.callSid,
        from: this.callerInfo.from,
        to: this.callerInfo.to,
        startTime: this.startTime,
        endTime: getPacificTimeISO(),
        conversationHistory: formattedHistory
      };

      const mode = config.postCallAgentMode;

      if (mode === 'active') {
        // Agent replaces existing flow, with fallback
        try {
          await runPostCallAgent(callData);
          console.log(`📞 [${this.callSid}] Agent summary saved`);
        } catch (agentErr) {
          console.error(`❌ [${this.callSid}] Post-call agent failed, falling back:`, agentErr.message);
          await callSummary.saveCallSummary(callData);
        }
      } else {
        // 'disabled' — existing flow only
        await callSummary.saveCallSummary(callData);
      }
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
