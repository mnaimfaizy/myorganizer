# An Escape Copy is opened by a tool that needs nothing of ours

## Status

accepted

The decision is made; no such tool exists yet. Nothing in this ADR describes shipped behaviour.

## Context

[ADR 0062](0062-the-drive-escape-hatch-holds-no-token-we-could-lose.md) settles what Vault Cloud
Backup is for: a copy of the User's Ciphertext, in storage the User controls, that survives
MyOrganizer going away. That purpose makes a claim about a world in which we do not exist, and a
claim like that is worth checking rather than assuming.

The cryptography checks out. `localToServerMeta` puts the KDF name, salt, hash and iteration count
into the export envelope, alongside _both_ wrappings of the Master Key — the passphrase wrapping and
the recovery-key wrapping — and the envelope carries all six Vault Blob Types. An Escape Copy plus a
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

## Consequences

The reader becomes a distribution problem as well as a build problem. A tool that only exists on a
server we might not have is not obviously better than no tool, so it has to be something a User can
hold — downloaded alongside an export, or fetched from somewhere that is not us. That question is
open and is not decided here.

It also becomes a security surface worth naming plainly: a file that accepts a vault passphrase is
exactly the thing an attacker would like to substitute. Whatever the distribution answer turns out
to be, it has to make a genuine copy distinguishable from a hostile one, and "we host it" is the
answer this ADR just gave up.
