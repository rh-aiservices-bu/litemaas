// Safety helpers for rendering untrusted markdown (chat messages, banners).
//
// Markdown images are loaded automatically by the browser, so model output can
// use them as tracking pixels or to exfiltrate data through the URL. PatternFly's
// chat Message component does not expose react-markdown's `disallowedElements`;
// it accepts extra rehype plugins through `additionalRehypePlugins` instead.

interface HastNode {
  tagName?: string;
  children?: HastNode[];
}

/**
 * Removes every `<img>` element from the markdown tree.
 *
 * Usage: `<Message additionalRehypePlugins={[rehypeStripImages]} />`
 */
export const rehypeStripImages =
  () =>
  (tree: HastNode): void => {
    const strip = (node: HastNode): void => {
      if (!node.children) {
        return;
      }
      node.children = node.children.filter((child) => child.tagName !== 'img');
      node.children.forEach(strip);
    };
    strip(tree);
  };
