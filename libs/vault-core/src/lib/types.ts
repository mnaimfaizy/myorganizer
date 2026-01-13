export type VaultRecordType = 'addresses' | 'mobileNumbers';

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};
