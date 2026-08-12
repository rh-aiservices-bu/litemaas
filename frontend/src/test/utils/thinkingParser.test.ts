import { describe, it, expect } from 'vitest';
import { extractReasoning, parseThinkingTags, resolveThinking } from '../../utils/thinkingParser';

describe('parseThinkingTags', () => {
  it('should return null thinking for content without think tags', () => {
    const result = parseThinkingTags('Hello, world!');
    expect(result).toEqual({
      thinking: null,
      response: 'Hello, world!',
      isThinkingComplete: true,
    });
  });

  it('should return null thinking for empty content', () => {
    const result = parseThinkingTags('');
    expect(result).toEqual({
      thinking: null,
      response: '',
      isThinkingComplete: true,
    });
  });

  it('should parse complete thinking tags', () => {
    const content = '<think>Let me reason about this.</think>The answer is 42.';
    const result = parseThinkingTags(content);
    expect(result).toEqual({
      thinking: 'Let me reason about this.',
      response: 'The answer is 42.',
      isThinkingComplete: true,
    });
  });

  it('should handle incomplete thinking tags during streaming', () => {
    const content = '<think>Still working on this...';
    const result = parseThinkingTags(content);
    expect(result).toEqual({
      thinking: 'Still working on this...',
      response: '',
      isThinkingComplete: false,
    });
  });

  it('should handle empty thinking tags', () => {
    const content = '<think></think>The answer is 42.';
    const result = parseThinkingTags(content);
    expect(result).toEqual({
      thinking: null,
      response: 'The answer is 42.',
      isThinkingComplete: true,
    });
  });

  it('should handle thinking with no response after', () => {
    const content = '<think>Just thinking out loud.</think>';
    const result = parseThinkingTags(content);
    expect(result).toEqual({
      thinking: 'Just thinking out loud.',
      response: '',
      isThinkingComplete: true,
    });
  });

  it('should handle multiline thinking content', () => {
    const content =
      '<think>Step 1: analyze\nStep 2: compute\nStep 3: respond</think>Here is my answer.';
    const result = parseThinkingTags(content);
    expect(result.thinking).toBe('Step 1: analyze\nStep 2: compute\nStep 3: respond');
    expect(result.response).toBe('Here is my answer.');
    expect(result.isThinkingComplete).toBe(true);
  });

  it('should handle open tag only during early streaming', () => {
    const content = '<think>';
    const result = parseThinkingTags(content);
    expect(result).toEqual({
      thinking: null,
      response: '',
      isThinkingComplete: false,
    });
  });

  it('should trim whitespace from thinking and response', () => {
    const content = '<think>  some thought  </think>  some response  ';
    const result = parseThinkingTags(content);
    expect(result.thinking).toBe('some thought');
    expect(result.response).toBe('some response');
  });
});

describe('extractReasoning', () => {
  it('should return null for undefined or null source', () => {
    expect(extractReasoning(undefined)).toBeNull();
    expect(extractReasoning(null)).toBeNull();
  });

  it('should return null when no reasoning fields are present', () => {
    expect(extractReasoning({})).toBeNull();
  });

  it('should extract top-level reasoning_content', () => {
    expect(extractReasoning({ reasoning_content: 'Let me think.' })).toBe('Let me think.');
  });

  it('should extract reasoning_content from provider_specific_fields', () => {
    expect(
      extractReasoning({ provider_specific_fields: { reasoning_content: 'Nested reasoning.' } }),
    ).toBe('Nested reasoning.');
  });

  it('should extract reasoning from provider_specific_fields.reasoning', () => {
    expect(
      extractReasoning({ provider_specific_fields: { reasoning: 'Provider reasoning.' } }),
    ).toBe('Provider reasoning.');
  });

  it('should prefer top-level reasoning_content over provider_specific_fields', () => {
    expect(
      extractReasoning({
        reasoning_content: 'Top level',
        provider_specific_fields: { reasoning_content: 'Nested', reasoning: 'Provider' },
      }),
    ).toBe('Top level');
  });

  it('should trim reasoning and normalize empty strings to null', () => {
    expect(extractReasoning({ reasoning_content: '  padded  ' })).toBe('padded');
    expect(extractReasoning({ reasoning_content: '   ' })).toBeNull();
    expect(extractReasoning({ reasoning_content: '' })).toBeNull();
  });
});

describe('resolveThinking', () => {
  it('should prefer a dedicated reasoning field over content', () => {
    const result = resolveThinking('The answer is 42.', 'Dedicated reasoning.');
    expect(result).toEqual({
      thinking: 'Dedicated reasoning.',
      response: 'The answer is 42.',
      isThinkingComplete: true,
    });
  });

  it('should not parse <think> tags out of content when a reasoning field is present', () => {
    const result = resolveThinking('<think>inline</think>Answer.', 'Dedicated reasoning.');
    expect(result.thinking).toBe('Dedicated reasoning.');
    expect(result.response).toBe('<think>inline</think>Answer.');
  });

  it('should mark reasoning incomplete while streaming with no content yet', () => {
    const result = resolveThinking('', 'Reasoning so far...', true);
    expect(result).toEqual({
      thinking: 'Reasoning so far...',
      response: '',
      isThinkingComplete: false,
    });
  });

  it('should mark reasoning complete once content starts streaming', () => {
    const result = resolveThinking('Partial answer', 'Reasoning done.', true);
    expect(result.isThinkingComplete).toBe(true);
  });

  it('should fall back to <think> tag parsing when no reasoning field is present', () => {
    const result = resolveThinking('<think>Reasoning here.</think>Answer.');
    expect(result).toEqual({
      thinking: 'Reasoning here.',
      response: 'Answer.',
      isThinkingComplete: true,
    });
  });

  it('should handle plain content with neither reasoning field nor tags', () => {
    const result = resolveThinking('Just a plain answer.');
    expect(result).toEqual({
      thinking: null,
      response: 'Just a plain answer.',
      isThinkingComplete: true,
    });
  });
});
