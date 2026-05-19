'use strict';

const WebSocket = require('ws');
const ProviderAdapter = require('./provider-adapter');
const config = require('../config');
const { PROVIDER_INFO_TOOL, SCHEDULING_TOOLS, FORWARD_TOOL, VOICEMAIL_TOOL, isSchedulingEnabled, isForwardingEnabled, isVoicemailEnabled, executeTool } = require('../agents/in-call-tools');

const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-realtime-2';
const OPENAI_REALTIME_URL = `wss://api.openai.com/v1/realtime?model=${OPENAI_REALTIME_MODEL}`;

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
      this._responseAudioCount = 0;
      this._responseTextSeen = false;
    }


  /**
   * Open WebSocket to OpenAI Realtime API.
   * Resolves when connection is open and session.update has been sent.
   */
  async connect(options) {
    const { systemPrompt, websiteContext, availabilityContext, callerPhone } = options || {};
    this.callerPhone = callerPhone || null;

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
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
            modalities: ['text', 'audio'],
            voice: this.voice,
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            turn_detection: {
              type: 'server_vad',
              silence_duration_ms: silenceDurationMs,
              prefix_padding_ms: prefixPaddingMs
            },
            input_audio_transcription: {
              model: 'whisper-1'
            },
            tools: [
              {
                type: 'function',
                name: 'hangup',
                description: 'End the call. Call this when the conversation is complete and it is time to hang up.',
                parameters: { type: 'object', properties: {} }
              },
              PROVIDER_INFO_TOOL,
              ...(isSchedulingEnabled() ? SCHEDULING_TOOLS : []),
              ...(isForwardingEnabled() ? [FORWARD_TOOL] : []),
              ...(isVoicemailEnabled() ? [VOICEMAIL_TOOL] : []),
            ],
            tool_choice: 'auto',
            instructions: instructions || ''
          }
        };

        this.ws.send(JSON.stringify(sessionUpdate));
        console.log(`📤 Session update sent, instructions length: ${instructions.length}`);

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
      case 'response.created':
        this._responseAudioCount = 0;
        this._responseTextSeen = false;
        break;

      case 'response.audio.delta':
        this._responseAudioCount++;
        if (this.onAudioOutput && event.delta) {
          this.onAudioOutput(event.delta);
        }
        break;

      case 'response.text.delta':
        this._responseTextSeen = true;
        break;

      case 'response.audio_transcript.done':
        if (this.onTranscript && event.transcript) {
          this.onTranscript('assistant', event.transcript);
        }
        if (event.transcript && this.goodbyeCallback && this._containsGoodbye(event.transcript)) {
          this.goodbyeCallback();
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

      case 'response.output_item.done':
        if (event.item?.type === 'function_call') {
          if (event.item.name === 'hangup') {
            console.log('📵 AI requested hangup');
            if (this.onHangupRequested) this.onHangupRequested(event.item.call_id);
            else if (this.onHangup) this.onHangup();
          } else {
            this._handleFunctionCall(event.item);
          }
        }
        break;

      case 'response.done':
        if (this._responseTextSeen && this._responseAudioCount === 0) {
          console.error('🚨 OpenAI returned text-only response with no audio — likely a refusal or oversized instructions');
          if (this.onTextOnlyRefusal) this.onTextOnlyRefusal();
        } else {
          console.log('✅ Response turn complete');
        }
        break;

      case 'response.cancelled':
        console.log('⚡ Response interrupted — cancelled by new speech input');
        break;

      case 'error':
        console.error(`❌ OpenAI Realtime error event:`, JSON.stringify(event.error));
        if (this.onError) {
          this.onError(new Error(event.error?.message || 'OpenAI Realtime API error'));
        }
        break;

      default:
        if (!['input_audio_buffer.committed', 'input_audio_buffer.speech_started',
              'input_audio_buffer.speech_stopped', 'conversation.item.created',
              'response.output_item.added', 'response.content_part.added',
              'response.content_part.done', 'response.output_item.done',
              'response.audio_transcript.delta'].includes(event.type)) {
          console.log(`[OpenAI event] ${event.type}`, JSON.stringify(event).slice(0, 200));
        }
    }
  }

  /**
   * Execute a scheduling function call and return the result to OpenAI.
   */
  sendFunctionResult(callId, result) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) },
    }));
    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  async _handleFunctionCall(item) {
    const { name, call_id, arguments: argsStr } = item;
    console.log(`🔧 AI called tool: ${name}`);

    let args = {};
    try { args = JSON.parse(argsStr || '{}'); } catch (_) {}

    let result;
    try {
      result = await executeTool(name, args, this.callerPhone, this.callSid);
    } catch (err) {
      console.error(`Tool ${name} failed:`, err.message);
      result = { error: err.message };
    }

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id,
        output: JSON.stringify(result),
      },
    }));

    this.ws.send(JSON.stringify({ type: 'response.create' }));
  }

  /**
   * Returns true if the transcript contains any of the given phrases as whole words.
   * @param {string} transcript
   * @param {string[]} [phrases] - defaults to config.goodbyePhrases
   * @returns {boolean}
   */
  _containsGoodbye(transcript, phrases) {
    const list = phrases || config.goodbyePhrases;
    return list.some(phrase =>
      new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(transcript)
    );
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
