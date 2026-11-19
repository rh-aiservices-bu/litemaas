import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import Message from '@patternfly/chatbot/dist/esm/Message/Message';
import { rehypeStripImages } from '../../utils/markdown.utils';

describe('Chatbot markdown security', () => {
  it('does not render markdown images from message content', () => {
    const { container } = render(
      <Message
        role="bot"
        content="Here is the result ![pixel](https://attacker.example/pixel.png) done"
        avatar="/avatar.png"
        additionalRehypePlugins={[rehypeStripImages]}
      />,
    );

    expect(container.querySelector('img[src*="attacker.example"]')).toBeNull();
    expect(container.innerHTML).not.toContain('attacker.example');
  });

  it('keeps text and links in message content', () => {
    const { container } = render(
      <Message
        role="bot"
        content="**Report** is at [example](https://example.com/report)"
        avatar="/avatar.png"
        additionalRehypePlugins={[rehypeStripImages]}
      />,
    );

    expect(container.textContent).toContain('Report');
    expect(container.querySelector('a[href="https://example.com/report"]')).not.toBeNull();
  });
});
