import type { VaultApi, VaultBlobType } from '@myorganizer/app-api-client';
import { mobileVaultCrypto, base64ToBytes, bytesToUtf8 } from './crypto';

/**
 * Read-only pull: fetches one encrypted Vault blob from the server and decrypts
 * it on-device with the Master Key, returning the parsed JSON. Returns `null`
 * when the server has no blob of that type (404) so callers can show an empty
 * state. This phase is one-way — there is no write/push counterpart.
 */
export async function pullDecryptedBlob(params: {
  vaultApi: VaultApi;
  masterKey: Uint8Array;
  type: VaultBlobType;
}): Promise<unknown | null> {
  let ciphertext: string;
  let iv: string;
  try {
    const response = await params.vaultApi.getVaultBlob({ type: params.type });
    ciphertext = response.data.blob.ciphertext;
    iv = response.data.blob.iv;
  } catch (err) {
    if ((err as { response?: { status?: number } })?.response?.status === 404) {
      return null;
    }
    throw err;
  }

  const plaintext = await mobileVaultCrypto.aesGcmDecrypt({
    key: params.masterKey,
    ciphertext: base64ToBytes(ciphertext),
    iv: base64ToBytes(iv),
  });

  return JSON.parse(bytesToUtf8(plaintext));
}
