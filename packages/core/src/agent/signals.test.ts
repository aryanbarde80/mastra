/**
 * Tests for packages/core/src/agent/signals.ts
 *
 * The pure exported functions are tested directly — no network I/O,
 * no async behaviour, no mocking required.
 */
import { describe, expect, it } from 'vitest';

import {
  createMessageSignal,
  createSignal,
  dataPartToSignal,
  isCreatedAgentSignal,
  isMastraSignalMessage,
  resolveDeliveryAttributes,
  signalToDataPartFormat,
  signalToMessage,
} from './signals';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSignalInput(overrides: Record<string, any> = {}): any {
  return {
    type: 'user',
    tagName: 'user',
    contents: 'hello world',
    ...overrides,
  };
}

function makeDBMessage(overrides: Record<string, any> = {}): any {
  return {
    id: 'msg-1',
    role: 'signal',
    createdAt: new Date(),
    type: 'user',
    content: {
      format: 2,
      parts: [{ type: 'text', text: 'hello' }],
      metadata: {
        signal: {
          type: 'user',
          id: 'sig-1',
          contents: 'hello',
        },
      },
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isMastraSignalMessage
// ---------------------------------------------------------------------------

describe('isMastraSignalMessage', () => {
  it('returns true for a message with role "signal"', () => {
    expect(isMastraSignalMessage(makeDBMessage({ role: 'signal' }))).toBe(true);
  });

  it('returns false for a message with role "user"', () => {
    expect(isMastraSignalMessage(makeDBMessage({ role: 'user' }))).toBe(false);
  });

  it('returns false for a message with role "assistant"', () => {
    expect(isMastraSignalMessage(makeDBMessage({ role: 'assistant' }))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isCreatedAgentSignal
// ---------------------------------------------------------------------------

describe('isCreatedAgentSignal', () => {
  it('returns true for a signal created by createSignal()', () => {
    const signal = createSignal(makeSignalInput());
    expect(isCreatedAgentSignal(signal)).toBe(true);
  });

  it('returns false for a plain signal input object', () => {
    expect(isCreatedAgentSignal(makeSignalInput())).toBe(false);
  });

  it('returns false for null', () => {
    expect(isCreatedAgentSignal(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isCreatedAgentSignal(undefined)).toBe(false);
  });

  it('returns false for an array', () => {
    expect(isCreatedAgentSignal([])).toBe(false);
  });

  it('returns false for a string', () => {
    expect(isCreatedAgentSignal('signal')).toBe(false);
  });

  it('returns false for a plain object without __isCreatedSignal', () => {
    expect(isCreatedAgentSignal({ type: 'user', contents: 'hello' })).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createSignal
// ---------------------------------------------------------------------------

describe('createSignal', () => {
  it('sets __isCreatedSignal = true', () => {
    const signal = createSignal(makeSignalInput());
    expect(signal.__isCreatedSignal).toBe(true);
  });

  it('preserves the type field', () => {
    const signal = createSignal(makeSignalInput({ type: 'notification' }));
    expect(signal.type).toBe('notification');
  });

  it('preserves the tagName field', () => {
    const signal = createSignal(makeSignalInput({ tagName: 'my-tag' }));
    expect(signal.tagName).toBe('my-tag');
  });

  it('exposes toLLMMessage method', () => {
    const signal = createSignal(makeSignalInput());
    expect(typeof signal.toLLMMessage).toBe('function');
  });

  it('exposes toDBMessage method', () => {
    const signal = createSignal(makeSignalInput());
    expect(typeof signal.toDBMessage).toBe('function');
  });

  it('exposes toDataPart method', () => {
    const signal = createSignal(makeSignalInput());
    expect(typeof signal.toDataPart).toBe('function');
  });

  it('toLLMMessage returns a user role message', () => {
    const signal = createSignal(makeSignalInput());
    const msg = signal.toLLMMessage();
    expect(msg.role).toBe('user');
  });

  it('toDataPart returns an object with type starting with "data-"', () => {
    const signal = createSignal(makeSignalInput());
    const part = signal.toDataPart();
    expect(part.type).toMatch(/^data-/);
  });

  it('accepts string contents', () => {
    const signal = createSignal(makeSignalInput({ contents: 'simple text' }));
    expect(signal.__isCreatedSignal).toBe(true);
  });

  it('accepts array contents', () => {
    const signal = createSignal(makeSignalInput({ contents: [{ type: 'text', text: 'part 1' }] }));
    expect(signal.__isCreatedSignal).toBe(true);
  });

  it('preserves custom attributes', () => {
    const signal = createSignal(makeSignalInput({ attributes: { priority: 'high' } }));
    expect(signal.attributes?.priority).toBe('high');
  });

  it('preserves metadata', () => {
    const signal = createSignal(makeSignalInput({ metadata: { source: 'test' } }));
    expect(signal.metadata?.source).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// resolveDeliveryAttributes
// ---------------------------------------------------------------------------

describe('resolveDeliveryAttributes', () => {
  it('returns the same signal when attributes is undefined', () => {
    const signal = createSignal(makeSignalInput());
    const result = resolveDeliveryAttributes(signal, undefined);
    expect(result).toBe(signal);
  });

  it('returns the same signal when attributes is empty object', () => {
    const signal = createSignal(makeSignalInput());
    const result = resolveDeliveryAttributes(signal, {});
    expect(result).toBe(signal);
  });

  it('merges new attributes into the signal', () => {
    const signal = createSignal(makeSignalInput({ attributes: { existing: 'yes' } }));
    const result = resolveDeliveryAttributes(signal, { newKey: 'newValue' });
    expect(result.attributes?.newKey).toBe('newValue');
    expect(result.attributes?.existing).toBe('yes');
  });

  it('new attributes override existing ones with the same key', () => {
    const signal = createSignal(makeSignalInput({ attributes: { priority: 'low' } }));
    const result = resolveDeliveryAttributes(signal, { priority: 'high' });
    expect(result.attributes?.priority).toBe('high');
  });

  it('returns a new CreatedAgentSignal (not mutating original)', () => {
    const signal = createSignal(makeSignalInput({ attributes: { priority: 'low' } }));
    const result = resolveDeliveryAttributes(signal, { priority: 'high' });
    expect(result).not.toBe(signal);
    expect(signal.attributes?.priority).toBe('low');
  });

  it('result is a valid CreatedAgentSignal', () => {
    const signal = createSignal(makeSignalInput());
    const result = resolveDeliveryAttributes(signal, { tag: 'urgent' });
    expect(isCreatedAgentSignal(result)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// signalToMessage
// ---------------------------------------------------------------------------

describe('signalToMessage', () => {
  it('returns a user role LLM message from a signal input', () => {
    const msg = signalToMessage(makeSignalInput());
    expect(msg.role).toBe('user');
  });

  it('returns a user role LLM message from a CreatedAgentSignal', () => {
    const signal = createSignal(makeSignalInput());
    const msg = signalToMessage(signal);
    expect(msg.role).toBe('user');
  });

  it('message content contains text from string contents', () => {
    const msg = signalToMessage(makeSignalInput({ contents: 'test message' }));
    const content = Array.isArray(msg.content) ? msg.content : [msg.content];
    const hasText = content.some(
      (c: any) =>
        (typeof c === 'string' && c.includes('test message')) ||
        (c?.type === 'text' && c.text?.includes('test message')),
    );
    expect(hasText).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// signalToDataPartFormat
// ---------------------------------------------------------------------------

describe('signalToDataPartFormat', () => {
  it('returns an object with type starting with "data-"', () => {
    const part = signalToDataPartFormat(makeSignalInput());
    expect(part.type).toMatch(/^data-/);
  });

  it('result has a data field containing the signal info', () => {
    const part = signalToDataPartFormat(makeSignalInput({ type: 'notification' }));
    expect(part.data).toBeDefined();
    expect(part.data.type).toBe('notification');
  });

  it('works with a CreatedAgentSignal input', () => {
    const signal = createSignal(makeSignalInput());
    const part = signalToDataPartFormat(signal);
    expect(part.type).toMatch(/^data-/);
  });
});

// ---------------------------------------------------------------------------
// createMessageSignal
// ---------------------------------------------------------------------------

describe('createMessageSignal', () => {
  it('creates a signal with type "user" from a string', () => {
    const signal = createMessageSignal('hello');
    expect(signal.type).toBe('user');
    expect(isCreatedAgentSignal(signal)).toBe(true);
  });

  it('creates a signal with type "user" from an array of parts', () => {
    const signal = createMessageSignal([{ type: 'text', text: 'hi' }]);
    expect(signal.type).toBe('user');
  });

  it('creates a signal with type "user" from an object with contents', () => {
    const signal = createMessageSignal({ contents: 'hello there' });
    expect(signal.type).toBe('user');
  });

  it('accepts optional id override', () => {
    const signal = createMessageSignal('hello', { id: 'custom-id' });
    expect(signal.id).toBe('custom-id');
  });

  it('tagName is "user"', () => {
    const signal = createMessageSignal('test');
    expect(signal.tagName).toBe('user');
  });
});

// ---------------------------------------------------------------------------
// dataPartToSignal
// ---------------------------------------------------------------------------

describe('dataPartToSignal', () => {
  it('reconstructs a CreatedAgentSignal from a data part', () => {
    const original = createSignal(makeSignalInput({ type: 'notification' }));
    const part = original.toDataPart();
    const reconstructed = dataPartToSignal(part);
    expect(isCreatedAgentSignal(reconstructed)).toBe(true);
    expect(reconstructed.type).toBe('notification');
  });

  it('round-trips type through data part', () => {
    const types = ['user', 'notification', 'system'] as const;
    for (const type of types) {
      const signal = createSignal(makeSignalInput({ type }));
      const part = signal.toDataPart();
      const reconstructed = dataPartToSignal(part);
      expect(reconstructed.type).toBe(type);
    }
  });

  it('round-trips attributes through data part', () => {
    const signal = createSignal(makeSignalInput({ attributes: { priority: 'high' } }));
    const part = signal.toDataPart();
    const reconstructed = dataPartToSignal(part);
    expect(reconstructed.attributes?.priority).toBe('high');
  });
});
