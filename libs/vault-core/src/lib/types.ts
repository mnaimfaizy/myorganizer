export type VaultRecordType =
  | 'addresses'
  | 'groceries'
  | 'mobileNumbers'
  | 'subscriptions'
  | 'tasks';

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};
