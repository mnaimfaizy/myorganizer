export type VaultRecordType =
  | 'addresses'
  | 'mobileNumbers'
  | 'subscriptions'
  | 'tasks';

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};
