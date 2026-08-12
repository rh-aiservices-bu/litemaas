export interface ParsedThinking {
  thinking: string | null;
  response: string;
  isThinkingComplete: boolean;
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
