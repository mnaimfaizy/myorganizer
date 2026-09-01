/**
 * Minting a Recovery Key — the pure half of Recovery Key Rotation.
 *
 * A Recovery Key is minted per Vault rather than chosen by the User, and it
 * wraps the Master Key directly instead of deriving anything (CONTEXT.md,
 * "Recovery Key"). This module is where one comes into existence, and it is
 * the only place: `initialize` mints through here too, so a Recovery Key
 * minted at Vault creation and one minted for a rotation cannot drift apart in
 * length, encoding, or entropy.
 *
 * The mint is deliberately separate from the commit that adopts it. Recovery
 * Key Rotation is the one Vault change with a step the User can fail — the new
 * key has to be recorded before the old one stops working — so the key is
 * minted and shown before anything is written, and a User who abandons the
 * flow after seeing it still has their old Recovery Key working. Nothing here
 * touches a Vault, storage, or the network; that is what makes abandoning it
 * free rather than a state to clean up.
 */
import { bytesToBase64, randomBytes } from './crypto';

/**
 * A Recovery Key this library minted, as opposed to one a caller supplied.
 *
 * Accepting a caller-supplied key is a capability this library has not had
 * before: every other Recovery Key it writes it also generated. The brand
 * keeps that true by construction at the commit — an attacker-chosen or weak
 * key fails to compile rather than merely being impolite.
 *
 * It is erasable by a cast and is documentation with teeth rather than a
 * security boundary. A caller determined to write their own key can still do
 * it; what they cannot do is arrive there by accident.
 */
export type MintedRecoveryKey = string & { readonly __minted: unique symbol };

/**
 * Mint a Recovery Key.
 *
 * Pure: no Vault is read, nothing is written locally, and nothing is sent. The
 * returned key is not this Vault's Recovery Key until
 * `rotateRecoveryKeyWithPassphrase` commits it.
 *
 * 32 random bytes, base64-encoded — the raw AES-256 key that wraps the Master
 * Key, carried as text because that is what the User has to write down.
 */
export function mintRecoveryKey(): MintedRecoveryKey {
  return bytesToBase64(randomBytes(32)) as MintedRecoveryKey;
}
