/**
 * Storybook renders in a browser, which has no `Buffer` global. The Email
 * Shell (`@myorganizer/email-shell`, ADR 0034) is authored for Node and calls
 * `Buffer.from(...)` to build its inline logo attachment on every render, so
 * a story that calls it unmodified needs this to exist before the story
 * renders. This is a preview-only compatibility shim, not a general-purpose
 * polyfill: it implements only the `from`/`toString` surface the shell
 * actually calls.
 */
class StorybookBuffer {
  constructor(private readonly bytes: Uint8Array) {}

  static from(input: string, encoding?: string): StorybookBuffer {
    if (encoding === 'base64') {
      const binary = atob(input);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new StorybookBuffer(bytes);
    }
    return new StorybookBuffer(new TextEncoder().encode(input));
  }

  toString(encoding?: string): string {
    if (encoding === 'base64') {
      let binary = '';
      this.bytes.forEach((byte) => {
        binary += String.fromCharCode(byte);
      });
      return btoa(binary);
    }
    return new TextDecoder().decode(this.bytes);
  }
}

if (typeof (globalThis as { Buffer?: unknown }).Buffer === 'undefined') {
  (globalThis as { Buffer?: unknown }).Buffer = StorybookBuffer;
}
