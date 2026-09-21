# An Escape Copy is opened by a tool that needs nothing of ours

## Status

accepted

The decision is made and the tool exists. The distribution question this ADR originally left open
is answered below, in "Distribution", from the grilling recorded on
[#792](https://github.com/mnaimfaizy/myorganizer/issues/792) (2026-09-19).

## Context

[ADR 0062](0062-the-drive-escape-hatch-holds-no-token-we-could-lose.md) settles what Vault Cloud
Backup is for: a copy of the User's Ciphertext, in storage the User controls, that survives
MyOrganizer going away. That purpose makes a claim about a world in which we do not exist, and a
claim like that is worth checking rather than assuming.

The cryptography checks out. `localToServerMeta` puts the KDF name, salt, hash and iteration count
into the export envelope, alongside _both_ wrappings of the Master Key — the passphrase wrapping and
the recovery-key wrapping — and the envelope carries all five Vault Blob Types. An Escape Copy plus a
passphrase, or an Escape Copy plus a recovery key, contains everything mathematically required to
recover the plaintext. Nothing about the recovery needs us.

Everything that can actually perform that recovery does. Restore runs through `useCloudBackup` on
the consolidated `/dashboard/vault` page, which sits inside `DashboardGuard` — an authenticated
session against the backend the User is escaping. `createVaultHandle({ owner })` binds to the
signed-in User by construction
([ADR 0047](0047-vault-access-is-obtained-through-an-owner-bound-handle.md)). And the route to the
file runs through Google Identity Services against an OAuth client ID in a Google Cloud project we
administer, so if the project lapses with the company, the Restore button stops working even for a
User whose Drive still holds every byte.

So the escape hatch cannot currently be opened without the thing it exists to escape. The math is
free of us; the only tool that performs the math is not. Left as it is, the feature's central
promise is aspirational, and aspirational is a poor property for the one mechanism whose entire job
is to work on our worst day.

The same is true, and has always been true, of the plain local-file Export. It produces the
identical envelope and is the more likely escape route.

## Decision

**An Escape Copy is readable by a tool that requires no MyOrganizer server, no MyOrganizer session,
and no Google account.** A single self-contained file — no network access of any kind — that takes
an export envelope and a passphrase or recovery key, and yields the plaintext.

**It covers the local-file Export and the Drive backup identically**, because they are the same
envelope, and the file-based one is the escape route more Users will actually reach for.

**A gate asserts it still opens a freshly produced envelope.** A reader pinned to a schema version
the exporter has moved past is worse than no reader: it fails at the only moment anyone runs it, and
it fails silently until then. This follows the repository's existing instinct that a claim about
another file is asserted rather than remembered
([ADR 0043](0043-gates-assert-facts.md)) — the envelope schema is the pinned value here, and pinned
values do not notice that their meaning moved
([ADR 0051](0051-a-pinned-value-does-not-notice-that-its-meaning-moved.md)).

## Considered options

**Publishing the envelope format and stopping.** Honest, free, and useless to nearly everybody who
would ever need it. It remains the right _documentation_ and is not a substitute for the tool.

**An unauthenticated import-only route in the app.** Cheaper, and it does not escape: it still
requires us to be hosting the app, which is the assumption under test. It would also put an
unauthenticated vault-writing path into the product to solve a problem that does not need one.

**Doing nothing** — treating "a copy exists in storage you control" as the whole promise, and
reading it as the User's problem. This is the status quo, and it is what makes
[ADR 0062](0062-the-drive-escape-hatch-holds-no-token-we-could-lose.md)'s reasoning circular: 0062
declines a refresh token _because_ the copy stays readable without us, which is only a reason if it
is true.

## Distribution

The reader is a distribution problem as well as a build problem. A tool that only exists on a server
we might not have is not obviously better than no tool, so it has to be something a User can hold.
This section records what that turned out to be.

**The canonical artifact is one self-contained HTML file, attached to every GitHub Release with a
published `SHA256SUMS.txt`.** Not a hosted page, because a hosted page is the assumption under test.
Not a CLI, because the User who needs this is not reliably one who has a toolchain. One file, opened
from `file://`, with the network cable out.

**Integrity is a published checksum plus copy that says why it matters.** A file that accepts a vault
passphrase is exactly the thing an attacker would like to substitute, and "we host it" is the answer
this ADR gave up. What is left is a number the User can check against a channel that is not the file,
and the honest instruction that goes with it: use only a reader you verified or one you saved
yourself from a release you already verified. The reader states this on its own face, above the
passphrase field, because the moment to say it is the moment before somebody types.

**The habit is co-location, prompted when a copy is made.** After a successful local Export and
after a successful Drive Escape Copy — including a scheduled one that ran with nobody present — the
vault page raises a prompt to fetch the reader from Releases and keep it with the copy, alongside
the checksum instruction. A copy the User cannot open is not a backup, and the moment they have just
made one is the moment they are thinking about it.

Three details are what shipped rather than what the phrase might suggest. The prompt sends the User
to the Releases page rather than serving the file, because serving it is the hosted-reader answer
this ADR gave up; the in-app expected-hash the grilling left optional is not built. It says a copy
was made, not that the User made one, because the scheduler makes copies unattended. And it stays up
for the life of the page rather than for a moment, because the User it is for is the one who left to
go and find the file.

**v1 browses on screen and writes no decrypted file.** Offering a "download decrypted archive"
button would turn one deliberate act of recovery into a plaintext file the User then has to
remember to delete.

**Both secrets open it.** Passphrase and Recovery Key, because a reader offering only one is
unopenable for exactly the User who lost the other — who is the User most likely to be holding an
Escape Copy at all.

**The reader's crypto is bundled from the app's own, never hand-copied.** `openEscapeCopy` lives in
`libs/vault-core` beside the envelope schema and the crypto suite, and the reader is an esbuild
bundle of a page shell around it. A reader with its own copy of PBKDF2 or AES-GCM would be a second
implementation of the one thing that must never disagree with the first — and it would disagree
silently, discovered at the only moment anybody runs it.

**Embedding the reader inside every export is deferred**, not rejected. It would make the copy and
the tool inseparable, which is attractive; it would also put a script inside a file Users are asked
to hand to storage providers, and it has no integrity story that a checksum does not already give.

## Consequences

`yarn escape-copy-reader:check` builds the reader, produces an envelope here and now with the real
`exportVault`, and opens it with the built artifact — both secrets, every Vault Blob Type, plaintext
compared. It also asserts the reader carries no way to reach the network or browser storage, and
that the published checksum is the checksum of the published file. It runs in CI rather than in the
pre-commit aggregate, because it builds a page and runs PBKDF2 four times.

The release pipeline now has a build step it did not have: `publish-github-release.yml` builds the
reader from the tag being published and attaches it, so the reader on a release is the reader that
release's exporter produces envelopes for.

The reader is a published artifact carrying our name that we have no way to recall. A defect in it
cannot be hot-fixed for a User already holding a copy; it can only be superseded by a later release
that the User has to go and fetch. That is the price of the escape hatch being an escape hatch, and
it is the reason the gate runs the built file rather than the sources it came from.
