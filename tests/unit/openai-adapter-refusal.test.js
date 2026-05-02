import { describe, it, expect, vi } from 'vitest';
import OpenAIAdapter from '../../src/realtime/openai-adapter.js';

function msg(obj) {
  return JSON.stringify(obj);
}

describe('OpenAIAdapter — text-only refusal detection', () => {
  it('does not fire onTextOnlyRefusal for a normal audio response', () => {
    const adapter = new OpenAIAdapter('fake-key', 'alloy');
    const onTextOnlyRefusal = vi.fn();
    const onAudioOutput = vi.fn();
    adapter.onTextOnlyRefusal = onTextOnlyRefusal;
    adapter.onAudioOutput = onAudioOutput;

    adapter._handleMessage(msg({ type: 'response.created' }));
    adapter._handleMessage(msg({ type: 'response.audio.delta', delta: 'AAAA' }));
    adapter._handleMessage(msg({ type: 'response.audio.delta', delta: 'BBBB' }));
    adapter._handleMessage(msg({ type: 'response.done' }));

    expect(onTextOnlyRefusal).not.toHaveBeenCalled();
    expect(onAudioOutput).toHaveBeenCalledTimes(2);
  });

  it('fires onTextOnlyRefusal when text arrives but no audio', () => {
    const adapter = new OpenAIAdapter('fake-key', 'alloy');
    const onTextOnlyRefusal = vi.fn();
    adapter.onTextOnlyRefusal = onTextOnlyRefusal;

    adapter._handleMessage(msg({ type: 'response.created' }));
    adapter._handleMessage(msg({ type: 'response.text.delta', delta: 'Sorry' }));
    adapter._handleMessage(msg({ type: 'response.done' }));

    expect(onTextOnlyRefusal).toHaveBeenCalledOnce();
  });

  it('does not fire onTextOnlyRefusal for a function-call response (no text, no audio)', () => {
    const adapter = new OpenAIAdapter('fake-key', 'alloy');
    const onTextOnlyRefusal = vi.fn();
    adapter.onTextOnlyRefusal = onTextOnlyRefusal;

    adapter._handleMessage(msg({ type: 'response.created' }));
    adapter._handleMessage(msg({ type: 'response.output_item.done', item: { type: 'function_call', name: 'hangup', call_id: '1', arguments: '{}' } }));
    adapter._handleMessage(msg({ type: 'response.done' }));

    expect(onTextOnlyRefusal).not.toHaveBeenCalled();
  });

  it('resets per-response tracking on response.created', () => {
    const adapter = new OpenAIAdapter('fake-key', 'alloy');
    const onTextOnlyRefusal = vi.fn();
    adapter.onTextOnlyRefusal = onTextOnlyRefusal;

    // First response: text-only (refusal)
    adapter._handleMessage(msg({ type: 'response.created' }));
    adapter._handleMessage(msg({ type: 'response.text.delta', delta: 'Sorry' }));
    adapter._handleMessage(msg({ type: 'response.done' }));
    expect(onTextOnlyRefusal).toHaveBeenCalledOnce();

    // Second response: normal audio — should NOT fire refusal again
    adapter._handleMessage(msg({ type: 'response.created' }));
    adapter._handleMessage(msg({ type: 'response.audio.delta', delta: 'AAAA' }));
    adapter._handleMessage(msg({ type: 'response.done' }));
    expect(onTextOnlyRefusal).toHaveBeenCalledOnce(); // still just once
  });

  it('does not fire onTextOnlyRefusal when response.done arrives with no events at all', () => {
    const adapter = new OpenAIAdapter('fake-key', 'alloy');
    const onTextOnlyRefusal = vi.fn();
    adapter.onTextOnlyRefusal = onTextOnlyRefusal;

    adapter._handleMessage(msg({ type: 'response.created' }));
    adapter._handleMessage(msg({ type: 'response.done' }));

    expect(onTextOnlyRefusal).not.toHaveBeenCalled();
  });
});
