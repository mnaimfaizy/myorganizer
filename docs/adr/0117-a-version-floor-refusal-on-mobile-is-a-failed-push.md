# A Version Floor refusal on mobile is a failed push

## Status

accepted

Supersedes decision 2 of [ADR 0114](0114-a-mobile-release-ships-in-1-0-what-it-cannot-learn-later.md). The rest of ADR 0114 stands. Tracked by [#956](https://github.com/mnaimfaizy/myorganizer/issues/956).

## Context

ADR 0114 decision 2 says that when the backend refuses a Mobile App below the Version Floor, "unsynced changes stay on the device and push after the update". That describes a client with a Local Vault, which is the web app. The Mobile App has none.

[ADR 0107](0107-a-mobile-vault-write-is-read-modify-write-against-the-server.md) decision 5 already settles what a mobile edit is: it lives only in memory, never outlives its screen, and is never persisted, which keeps the rule that mobile does not persist vault data. There is therefore nothing unsynced on the device to keep. At most there is one in-flight edit on the screen in front of the User, and updating the app restarts it, which ends that edit.

The error was found while slicing #956, before anything was built to it.

## Decision

1. **A 426 on a mobile push is a failed push under ADR 0107.** The edit is never reported as saved. The screen reverts to the last server-confirmed copy, as it does for any other failed push.
2. **The update screen says so.** When the refusal arrives during an edit, the blocking update screen states plainly that the last change was not saved and why, before it sends the User to the store.
3. **Nothing is persisted to survive the update.** Holding the refused edit, as ciphertext or otherwise, so it can merge after the update is rejected here. It would give the Mobile App a Local Vault in miniature, which ADR 0107 decided against. That is a larger decision than the Version Floor and is not made here.

## Consequences

- ADR 0114's warning still holds in its general form: a client must never treat a refusal as the server accepting or discarding its data. On mobile that means telling the User their edit was not saved, never implying that it was.
- Because a refusal arrives on the first request after the floor rises, most Users meet the update screen at launch, before they start an edit. The lost in-flight edit is the narrow case of a floor raised mid-session.
- [`CONTEXT.md`](../../CONTEXT.md) § Release & Deploy, Version Floor, is corrected to match.
