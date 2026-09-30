# A Mobile Release ships in 1.0 what it cannot learn later

## Status

accepted

## Context

Grilled 2026-09-30 while planning the first Mobile Release to Google Play and the App Store.

A Release is live everywhere the moment Host Apply finishes, because every browser loads the latest web app. A Mobile Release is not. Store review and rollout sit between the decision and the User, and every earlier Mobile Release stays installed and in use, possibly for years, against a backend and a web app that keep moving. An installed Mobile App only reacts to what it was built to understand. Any behaviour it lacks cannot be added to it afterwards. It can only be added to the next Mobile Release, and the Users who never update never get it.

Two failures follow from that, and neither can be fixed after 1.0 ships.

**An old Mobile App cannot be told to stop.** Nothing in the request identifies the client, and nothing on the backend can refuse one. When an endpoint later changes shape, an old install does not fail cleanly. It fails however that change happens to break it.

**An old Mobile App silently destroys vault fields it does not know.** The server stores ciphertext only, so it cannot detect or repair this. `normalizeTasks` in `libs/web/vault/src/lib/vault/taskNormalization.ts` rebuilds each Task field by field, and a field it does not name is gone on the next resave. Its own comment records that this has already bitten once (#915), when a Task's close date was erased. While web and mobile ship together the window is short. With a lagging Mobile App it is the normal case: the web adds a field, the User fills it in, and an older phone saving that Vault Blob erases it. Merging by record does not help, because it keeps the newer record whole ([ADR 0054](0054-a-vault-blob-converges-by-record-and-absence-is-recorded.md)), and the newer record is the one the old client rewrote without the field.

## Decision

1. **The first Mobile Release carries a Version Floor.** Every Mobile App request identifies its platform and its Mobile Release version. Each environment's backend holds the lowest Mobile Release it still serves, as configuration. A request below it is refused with HTTP 426 and a typed body. A request that does not identify itself, as the web app's requests do not, passes untouched. The comparison is on the Mobile Release's semver version, which is shared by both platforms, and never on the per-platform build numbers.

2. **A refusal is not a rejection of data.** The Mobile App handles a 426 in one place and shows a blocking update screen. Unsynced changes stay on the device and push after the update. A client that treats the refusal as the server discarding its write loses exactly the data the floor exists to protect.

3. **A client preserves what it does not understand.** Every path that writes a Vault Blob, on web and on mobile, carries unknown fields through untouched: on the record, and on the envelope around the records. Adding a field is then safe for every Mobile Release still installed.

4. **A change of meaning takes a new name, never a repurposed field.** When a field's type or purpose changes, the new meaning gets a new field name. If an old client acting on the old field would now be wrong, the Version Floor is raised past it. An existing field is never reused for a new meaning, because an old client would read and write it under the old one.

## Considered Options

- **Add the floor later, when the first breaking change arrives.** Rejected. The floor protects against installs that already exist, and those installs are exactly the ones that cannot learn it.
- **A shape version on every Vault Blob Type, with a client going read-only for a type newer than it knows.** Rejected for now. It covers changes of meaning as well as additions, but it costs a version on every type and blocks Users more often. Decision 4 keeps changes of meaning rare enough that the floor covers them. This can still be added later, because a client that preserves unknown fields also preserves a version field it does not read.
- **Raise the Version Floor on every vault change.** Rejected. Every web feature would force a mobile update, and a Vault Blob can still be damaged by an old client between the web deploy and the floor rising.
- **A soft "update available" prompt, or Android in-app updates.** Deferred, not rejected. Either can arrive in any later Mobile Release. Only the hard floor has to be there from the first one.

## Consequences

- The backend gains a request check and a per-environment setting. That is an API contract change, so it goes through the backend API-contract workflow.
- Every Vault Blob writer needs a round-trip test per Vault Blob Type proving that an unknown field survives a save, on web and on mobile.
- The Mobile App's release configuration, including its version, is what the floor reads. A Mobile Release whose version was not bumped cannot be told apart from the one before it.
- Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) § Release & Deploy (Mobile Release, Version Floor). The release procedure is [`MOBILE_RELEASE_PROCESS.md`](../deployment/MOBILE_RELEASE_PROCESS.md).
