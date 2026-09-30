// Web variant of ./bytes, selected by the Vite `resolve.extensions` list in
// apps/mobile/vite.config.mts (`.web.ts` precedes `.ts`), for the same reason
// ./crypto.web.ts exists.
//
// The native module converts through `@craftzdog/react-native-buffer`, which
// requires react-native-quick-base64 on React Native. That package imports
// `TurboModuleRegistry`, which react-native-web does not ship, so the native
// module cannot be part of the `mobile:build` graph. The platform's own
// base64 and UTF-8 codecs produce the same bytes.

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function utf8ToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}
