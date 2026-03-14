'use strict';

const WebSocket = require('ws');
const ProviderAdapter = require('./provider-adapter');
const config = require('../config');

const OPENAI_REALTIME_URL = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17';

/**
 * OpenAI Realtime API provider adapter.
 * Connects to OpenAI's Realtime API via WebSocket and translates
 * between the common ProviderAdapter interface and OpenAI's protocol.
 */
class OpenAIAdapter extends ProviderAdapter {
  constructor(apiKey, voice) {
      super();
      this.apiKey = apiKey;
      this.voice = voice || 'alloy';
      this.ws = null;
      this.keepaliveInterval = null;
    }


  /**
   * Open WebSocket to OpenAI Realtime API.
   * Resolves when connection is open and session.update has been sent.
   */
  async connect(options) {
    const { systemPrompt, websiteContext, availabilityContext, callerPhone } = options || {};

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        // Build combined instructions from all context sources
        const instructionParts = [systemPrompt];
        
        // Add caller information if available
        if (callerPhone) {
          instructionParts.push(
            '='.repeat(50) + '\n' +
            'CALLER INFORMATION:\n' +
            '='.repeat(50) + '\n' +
            `The caller's phone number is: ${callerPhone}\n` +
            'If the caller asks for their callback number or the number they\'re calling from, you can provide this information.'
          );
        }
        
        // Add website and availability context
        if (websiteContext) {
          instructionParts.push(websiteContext);
        }
        if (availabilityContext) {
          instructionParts.push(availabilityContext);
        }
        
        const instructions = instructionParts.filter(Boolean).join('\n\n');

        // Read VAD parameters from centralized config — no inline literals
        const { silenceDurationMs, prefixPaddingMs } = config.realtime.vad;

        // Send session.update with voice, audio format, VAD, transcription, and instructions
        const sessionUpdate = {
          type: 'session.update',
          session: {
            voice: this.voice,
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            turn_detection: {
              type: 'server_vad',
              silence_duration_ms: silenceDurationMs,
              prefix_padding_ms: prefixPaddingMs,
              threshold: parseFloat(process.env.OPENAI_VAD_THRESHOLD || "0.7"),
            },
            input_audio_transcription: {
              model: 'whisper-1'
            },
            instructions: instructions || ''
          }
        };

        this.ws.send(JSON.stringify(sessionUpdate));

        // Trigger an immediate greeting by injecting a user turn
        // This makes the AI speak immediately when the call connects
        this.ws.send(JSON.stringify({
          type: 'conversation.item.create',
          item: {
            type: 'message',
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: '[System: Greet the caller now]'
              }
            ]
          }
        }));

        // Trigger response generation immediately
        this.ws.send(JSON.stringify({
          type: 'response.create'
        }));

        // Start keepalive mechanism to prevent WebSocket timeout during silence
        this._startKeepalive();

        resolve();
      });

      this.ws.on('message', (data) => {
        this._handleMessage(data);
      });

      this.ws.on('error', (err) => {
        if (this.onError) this.onError(err);
        reject(err);
      });

      this.ws.on('close', () => {
        if (this.onClose) this.onClose();
      });
    });
  }

  /**
   * Parse incoming OpenAI WebSocket messages and dispatch to callbacks.
   */
  _handleMessage(rawData) {
    let event;
    try {
      event = JSON.parse(rawData.toString());
    } catch (err) {
      if (this.onError) this.onError(new Error('Failed to parse OpenAI message'));
      return;
    }

    switch (event.type) {
      case 'response.audio.delta':
        if (this.onAudioOutput && event.delta) {
          this.onAudioOutput(event.delta);
        }
        break;

      case 'response.audio_transcript.done':
        this.lastResponseText = event.transcript || '';
        if (this.onTranscript && event.transcript) {
          this.onTranscript('assistant', event.transcript);
        }
        break;

      case 'conversation.item.input_audio_transcription.completed':
        if (this.onTranscript && event.transcript) {
          this.onTranscript('caller', event.transcript);
        }
        break;

      case 'input_audio_buffer.speech_started':
        console.log('🎤 Speech started — VAD detected caller audio');
        if (this.onSpeechStarted) {
          this.onSpeechStarted();
        }
        break;

      case 'input_audio_buffer.speech_stopped':
        console.log('🔇 Speech stopped — VAD detected end of caller turn');
        break;

      case 'response.done':
        console.log('✅ Response turn complete');
        
        // Check if AI said goodbye - trigger call end
        if (this.lastResponseText && /\b(goodbye|bye|take care|have a great day)\b/i.test(this.lastResponseText) && this.goodbyeCallback) {
          console.log('👋 Goodbye detected in AI response — ending call');
          setTimeout(() => this.goodbyeCallback(), 2000); // 2 second delay to let audio finish
        }
        
        // Check if AI wants to transfer the call to PJ
        if (this.lastResponseText && /\b(connect you|transfer|connecting you|let me get PJ|putting you through)\b/i.test(this.lastResponseText) && this.transferCallback) {
          console.log('📞 Transfer detected in AI response — connecting to PJ');
          setTimeout(() => this.transferCallback(), 3000); // 3 second delay to let David finish speaking
        }
        break;

      case 'response.cancelled':
        console.log('⚡ Response interrupted — cancelled by new speech input');
        break;

      case 'error':
        if (this.onError) {
          this.onError(new Error(event.error?.message || 'OpenAI Realtime API error'));
        }
        break;
    }
  }

  /**
   * Send base64-encoded audio to OpenAI.
   */
  sendAudio(audioPayload) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: audioPayload
    }));
  }

  /**
   * Cancel the current in-progress response.
   */
  cancelResponse() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    console.log('⚡ Cancelling in-progress response due to interruption');
    this.ws.send(JSON.stringify({
      type: 'response.cancel'
    }));
  }

  /**
   * Close the WebSocket connection.
   */
  close() {
    // Stop keepalive mechanism
    this._stopKeepalive();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
  /**
   * Start sending periodic keepalive pings to prevent WebSocket timeout.
   * Sends a session.update with empty update every 30 seconds.
   */
  _startKeepalive() {
    // Clear any existing interval
    this._stopKeepalive();

    console.log('🔄 Starting OpenAI WebSocket keepalive (30s interval)');

    this.keepaliveInterval = setInterval(() => {
      try {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          // Send session.update with empty update as keepalive ping
          // This is safe and idempotent - doesn't affect conversation state
          this.ws.send(JSON.stringify({
            type: 'session.update',
            session: {}
          }));
          console.log('💓 OpenAI keepalive ping sent');
        }
      } catch (err) {
        // Don't propagate keepalive errors to main error handler
        // Just log at debug level to avoid noise
        console.log('⚠️ OpenAI keepalive ping failed:', err.message);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Stop sending keepalive pings.
   */
  _stopKeepalive() {
    if (this.keepaliveInterval) {
      clearInterval(this.keepaliveInterval);
      this.keepaliveInterval = null;
      console.log('🛑 OpenAI WebSocket keepalive stopped');
    }
  }
}

module.exports = OpenAIAdapter;
