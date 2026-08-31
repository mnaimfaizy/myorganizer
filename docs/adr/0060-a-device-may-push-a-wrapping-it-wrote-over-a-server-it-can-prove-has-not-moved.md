# A device may push a wrapping it wrote, over a server state it can prove has not moved

## Status

accepted

## Context

[ADR 0057](0057-vault-meta-converges-separately-and-never-silently.md) settled one direction of
Vault Meta movement: adopting a wrapping made on another device is the one move that can brick a
Local Vault, a wrapping cannot be verified without the passphrase it was derived from, so adoption
never happens without an explicit answer and `convergeVaultMeta` structurally cannot write.

Nothing settled the other direction, and the result was that no local wrapping change ever left the
device that made it ([#589](https://github.com/mnaimfaizy/myorganizer/issues/589)). The only Vault
Meta write was Vault Reconcile's, guarded by "the server holds no Vault Meta at all", so once the
server held one nothing ever replaced it.

The reachable path was the recovery branch of the Vault Gate — lock, "Forgot passphrase", paste a
recovery key, set a new passphrase — which is the worst instance, because it is the one case where
the User has already declared the old passphrase unusable. After it, the server still held the
wrapping for the passphrase they could not remember; every other device still unlocked with it; and
on this device's next session the meta prompt said _"your passphrase was changed on another device"_
and offered a button that silently restored the forgotten one. No data was lost — both wrappings hold
the same Master Key, since the salt does not move — but the prompt lied about where the change came
from, and it returned every session because nothing settled the divergence.

The obvious repair is a write path. The reason there wasn't one is that a write path is, by
construction, a path that can overwrite another device's wrapping.

## Decision

**A Vault Meta Push is a different act from adoption, and is allowed on narrower terms.** The
wrapping being sent is one this device wrote itself, so there is nothing to verify. What still has to
be established is that nobody else moved the server's wrapping in the meantime.

**The safety claim is not "this device holds the Master Key".** That is true of the push made
immediately after a change and false of the retry, which runs at session start against a Vault that
is usually locked — the meta runner fires on the owner, not on unlock. Gating the retry on an
unlocked handle would be theatre: unlocking proves the typed passphrase matches the local wrapping,
not that the wrapping is the one the User wants on the server, and in the motivating case the User
has just recovered and may not unlock again for days. The claim that holds for both paths is
narrower: _a device may push a wrapping it wrote itself, and only over a server state it can prove
has not moved since._

**A Vault Meta Bookmark carries that proof.** It records the hash of the Vault Meta this device and
the server last agreed on, beside the Sync Bookmarks in the same per-User record. Both questions are
derived from it rather than flagged beside it — this device owes a push when its Vault Meta no longer
matches the bookmark, and the server has moved when the server's no longer does. A flag set at change
time and cleared at push time would strand the change whenever the setting was missed, which is the
shape [ADR 0058](0058-a-sync-bookmark-is-a-second-per-user-namespace-not-a-second-vault.md) already
rejected for Vault Blobs.

**A moved server is refused, not merged and not prompted.** The divergence it leaves is exactly what
Vault Meta Converge exists to resolve, at session start, where the User is not mid-flow. A User who
has just typed a new passphrase is in the worst position to answer a question about a different
wrapping change on another device — they cannot verify either one, which is ADR 0057's whole premise.
The push does not need its own conflict UI because the product already has one.

**Push before asking.** `settleVaultMeta` pushes what this device owes and only then converges what
is left. A device that changed its own wrapping and could not push it is indistinguishable at a
glance from one whose wrapping changed elsewhere, so asking first is what produced the lying prompt.
It composes above `convergeVaultMeta` exactly as Vault Reconcile composes above `convergeVaultBlob`:
the write capability lives in the composition, never in the primitive.

**The local change is never rolled back for a failed push.** A User who has just set a passphrase
must be able to use it, whatever the network did. The failure is reported instead, naming the fact
they can act on: their other devices still unlock with the old passphrase.

## Consequences

ADR 0057 is unchanged and not weakened. Its claims — adoption never happens implicitly, and
`convergeVaultMeta` takes `getVaultMeta` and nothing else — remain literally true. What changes is
that they are no longer the whole story about Vault Meta, and the module doc says so.

`putServerVaultMetaEtagAware` is no longer reserved for a server holding no Vault Meta, and its
`onConflict` parameter is now required rather than defaulted. The old default raised a
`window.confirm` from inside the library — the shape ADR 0057 was written against — and leaving it
in place would have made the next call site's silence a trap rather than a choice. Vault Reconcile's
pre-existing call now passes one too: on the race where a Vault Meta appears between its read and
its write, it keeps the remote copy. The Vault Blob path keeps its default, because Ciphertext a
handler chooses between can at least be decrypted and compared.

The salt becomes load-bearing in a new way. `changePassphrase` re-derives from the salt the Vault
already has, which is what keeps a rotation legible as a rotation. A future change that minted a
fresh salt would make this device's own rotation read as a _different vault_
([#578](https://github.com/mnaimfaizy/myorganizer/issues/578) pointing the other way), and pushing
there would leave the server's Ciphertext guarded by a key it was not encrypted under. The pinned
`VAULT_META_CHANGE_PUSHABLE` table refuses that, and is checked before the base comparison rather
than after it: a server holding a separately initialized Vault is not a stale base to be caught up,
and no proof about the base makes pushing over it right.

Losing a Vault Meta Bookmark degrades to the previous behaviour — a prompt that may misattribute a
change — never to lost data. That is the right failure direction and matches ADR 0058's
replaced-rather-than-refused rule.
