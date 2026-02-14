'use strict';

/**
 * Abstract base class defining the contract all realtime AI provider adapters must implement.
 * The Relay Service communicates with any provider exclusively through this interface.
 */
class ProviderAdapter {
  constructor() {
    // Event callbacks (set by Relay Service)

    /** @type {function(string): void} Called with base64 audio chunk */
    this.onAudioOutput = null;

    /** @type {function(string, string): void} Called with (role, text) */
    this.onTranscript = null;

    /** @type {function(): void} Called when caller speech is detected */
    this.onSpeechStarted = null;

    /** @type {function(Error): void} Called on provider error */
    this.onError = null;

    /** @type {function(): void} Called when provider connection closes */
    this.onClose = null;
  }

  /**
   * Open connection to the realtime AI provider.
   * @param {Object} options
   * @param {string} options.systemPrompt - System instructions
   * @param {string} options.websiteContext - Scraped website content
   * @param {string} options.availabilityContext - Provider availability info
   */
  async connect(options) {
    throw new Error('Not implemented');
  }

  /**
   * Send audio input to the provider.
   * @param {string} audioPayload - Base64-encoded audio data
   */
  sendAudio(audioPayload) {
    throw new Error('Not implemented');
  }

  /**
   * Cancel the current in-progress response.
   */
  cancelResponse() {
    throw new Error('Not implemented');
  }

  /**
   * Close the provider connection.
   */
  close() {
    throw new Error('Not implemented');
  }
}

module.exports = ProviderAdapter;
