export type VaultRecordType = 'addresses' | 'mobileNumbers' | 'subscriptions';

export type EncryptedBlob = {
  iv: string;
  ciphertext: string;
};
