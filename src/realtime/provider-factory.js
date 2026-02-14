'use strict';

const OpenAIAdapter = require('./openai-adapter');

/**
 * Factory function that instantiates the correct provider adapter based on configuration.
 * Returns null when the provider can't be initialized (missing API key, unknown provider),
 * signaling the system to fall back to Gather-based calls.
 *
 * @param {string} [providerName] - Provider name (defaults to 'openai')
 * @param {Object} config - Application config object
 * @returns {import('./provider-adapter')|null}
 */
function createProviderAdapter(providerName, config) {
  const name = providerName || 'openai';

  switch (name) {
    case 'openai':
      if (!config.openai.apiKey) return null;
      return new OpenAIAdapter(config.openai.apiKey, config.openai.realtimeVoice);
    default:
      console.warn(`Unknown realtime provider: ${name}`);
      return null;
  }
}

module.exports = { createProviderAdapter };
