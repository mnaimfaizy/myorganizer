// Buffer/base64 conversions, split out from `crypto.ts` so they carry no
// dependency on `react-native-quick-crypto`. `@craftzdog/react-native-buffer`
// is a pure JS Buffer shim (no native binding), so this module loads under a
// plain Node Jest environment as readily as it does on a device — which is
// what lets `unlock.ts` stay unit-testable without a React Native runtime.
import { Buffer } from '@craftzdog/react-native-buffer';

export function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

export function base64ToBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

export function utf8ToBytes(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'utf8'));
}

export function bytesToUtf8(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('utf8');
}
