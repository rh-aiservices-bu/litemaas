import { describe, it, expect } from 'vitest';
import { parseThinkingTags } from '../../utils/thinkingParser';

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
    const content = '<think>Step 1: analyze\nStep 2: compute\nStep 3: respond</think>Here is my answer.';
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
