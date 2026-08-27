export type VaultRecordType =
  | 'addresses'
  | 'groceries'
  | 'mobileNumbers'
  | 'subscriptions'
  | 'tasks'
  | 'todos';

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};
