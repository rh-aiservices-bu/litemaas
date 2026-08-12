import type { ReasoningFields } from '../types/chat';

export interface ParsedThinking {
  thinking: string | null;
  response: string;
  isThinkingComplete: boolean;
}

/**
 * Extract reasoning text from a provider payload field.
 *
 * Some providers/engines (e.g. DeepSeek R1 distills served through LiteLLM) return the reasoning
 * trace in a dedicated `reasoning_content` field rather than inline as `<think>...</think>` tags.
 * LiteLLM also mirrors it under `provider_specific_fields`. This checks all known locations and
 * returns the trimmed text, or null when absent.
 */
export function extractReasoning(source?: ReasoningFields | null): string | null {
  if (!source) {
    return null;
  }

  const reasoning =
    source.reasoning_content ||
    source.provider_specific_fields?.reasoning_content ||
    source.provider_specific_fields?.reasoning;

  const trimmed = reasoning?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Resolve the thinking/response split for an assistant message.
 *
 * A dedicated reasoning field (from {@link extractReasoning}) takes precedence over inline
 * `<think>` tags. When no reasoning field is present, this falls back to parsing tags out of the
 * content string via {@link parseThinkingTags}.
 */
export function resolveThinking(
  content: string,
  reasoning?: string | null,
  isStreaming = false,
): ParsedThinking {
  if (reasoning) {
    return {
      thinking: reasoning,
      response: content,
      // With a dedicated reasoning field, reasoning finishes once the answer begins streaming
      // (or immediately for a non-streaming response).
      isThinkingComplete: !isStreaming || content.length > 0,
    };
  }

  return parseThinkingTags(content);
}

export function parseThinkingTags(content: string): ParsedThinking {
  if (!content) {
    return { thinking: null, response: '', isThinkingComplete: true };
  }

  const openTag = '<think>';
  const closeTag = '</think>';

  const openIndex = content.indexOf(openTag);
  if (openIndex === -1) {
    return { thinking: null, response: content, isThinkingComplete: true };
  }

  const thinkingStart = openIndex + openTag.length;
  const closeIndex = content.indexOf(closeTag, thinkingStart);

  if (closeIndex === -1) {
    const thinking = content.substring(thinkingStart).trim();
    return {
      thinking: thinking || null,
      response: '',
      isThinkingComplete: false,
    };
  }

  const thinking = content.substring(thinkingStart, closeIndex).trim();
  const beforeThink = content.substring(0, openIndex);
  const afterThink = content.substring(closeIndex + closeTag.length);
  const response = (beforeThink + afterThink).trim();

  return {
    thinking: thinking || null,
    response,
    isThinkingComplete: true,
  };
}
