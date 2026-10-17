/**
 * User text and retrieved documents are data, never instructions. We (1) wrap them in tagged
 * blocks the system prompt names as untrusted, and (2) neutralise angle brackets so the text
 * cannot close the block and masquerade as system content.
 */
export function neutralize(text: string): string {
  return text.replace(/</g, '‹').replace(/>/g, '›');
}

export function untrustedBlock(tag: string, content: string): string {
  return `<${tag}>\n${neutralize(content)}\n</${tag}>`;
}

const URL_RE = /https?:\/\/[^\s)>\]"']+/gi;

/** Removes any URL the model wrote that is not one of the vetted source URLs. */
export function stripUnapprovedUrls(text: string, allowed: Set<string>): string {
  return text.replace(URL_RE, (u) => {
    const clean = u.replace(/[.,;]+$/, '');
    return allowed.has(clean) || allowed.has(clean.replace(/\/$/, ''))
      ? u
      : '[link removed – use the official sources below]';
  });
}
