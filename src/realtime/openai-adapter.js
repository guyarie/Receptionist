'use strict';

const WebSocket = require('ws');
const ProviderAdapter = require('./provider-adapter');

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
  }

  /**
   * Open WebSocket to OpenAI Realtime API.
   * Resolves when connection is open and session.update has been sent.
   */
  async connect(options) {
    const { systemPrompt, websiteContext, availabilityContext } = options || {};

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(OPENAI_REALTIME_URL, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'OpenAI-Beta': 'realtime=v1'
        }
      });

      this.ws.on('open', () => {
        // Build combined instructions from all context sources
        const instructions = [systemPrompt, websiteContext, availabilityContext]
          .filter(Boolean)
          .join('\n\n');

        // Send session.update with voice, audio format, VAD, transcription, and instructions
        const sessionUpdate = {
          type: 'session.update',
          session: {
            voice: this.voice,
            input_audio_format: 'g711_ulaw',
            output_audio_format: 'g711_ulaw',
            turn_detection: {
              type: 'server_vad'
            },
            input_audio_transcription: {
              model: 'whisper-1'
            },
            instructions: instructions || ''
          }
        };

        this.ws.send(JSON.stringify(sessionUpdate));

        // Trigger an immediate greeting by sending a conversation item with the greeting text
        // This makes the AI speak immediately when the call connects
        const greetingMessage = options.greeting || 'Hello! How can I help you today?';
        
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
        if (this.onSpeechStarted) {
          this.onSpeechStarted();
        }
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

    this.ws.send(JSON.stringify({
      type: 'response.cancel'
    }));
  }

  /**
   * Close the WebSocket connection.
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

module.exports = OpenAIAdapter;
