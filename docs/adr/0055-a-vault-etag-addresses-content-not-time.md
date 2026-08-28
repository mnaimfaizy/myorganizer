# A Vault ETag addresses content, not time

## Status

accepted

## Context

`VaultService` derived every Vault ETag from the row's timestamp:

```ts
function etagFromDate(date: Date): string {
  return `W/"${date.getTime()}"`;
}
```

Two server writes landing in the same millisecond therefore produce the same ETag for different
Ciphertext. The resulting lost update is silent: device A pushes (server at `M`), device B pushes
different content (also `M`), and A later pushes with `If-Match: M`. The server matches, accepts,
and B's write is gone. No 409, so no merge, so no prompt — silent destruction of a User's
Ciphertext, which is the failure class
[ADR 0033](0033-local-vaults-are-user-owned-and-never-silently-destroyed.md) and
[#512](https://github.com/mnaimfaizy/myorganizer/issues/512) exist over.

The window was nearly unreachable while nothing persisted an ETag: every caller fetched a fresh one
immediately before its PUT, so the collision needed two requests in flight within one millisecond.
Sync Bookmarks ([#513](https://github.com/mnaimfaizy/myorganizer/issues/513)) change that. They
store the ETag across reloads and across days, and the collision stops being a race between two
requests and becomes a race between a stored value and the world.

## Decision

A Vault ETag is a content hash of the stored Ciphertext. The clock is removed from correctness:
same bytes, same ETag; different bytes, different ETag.

This is not merely safer than a timestamp, it is a better fit than the conventional alternative. A
monotonic `version` column answers "how many times has this been written." A content hash answers
"is the server still holding what I think it is holding" — which is exactly the merge precondition,
and the only question any caller of `If-Match` is actually asking. It also costs no Prisma
migration, no schema change, and no OpenAPI change: the ETag is a string in the contract either
way.

Changed as part of #513 rather than after it, because deploying it invalidates every outstanding
timestamp ETag. Done before Sync Bookmarks ship, that costs at most one extra 409 on an already-open
page. Done after, it invalidates durable state on real Users' devices.

## Consequences

`GET /vault/blob/{type}` gains `If-None-Match` and `304`, which is what makes a focus-triggered
Vault Pull affordable — six conditional requests that are almost always empty, rather than six full
blob bodies at up to 256 KiB each.

A content-addressed ETag returns to a previous value if the Ciphertext does, so a server that goes
X → Y → X will accept an `If-Match` held from the first X. That is correct: the server _is_ holding
X. A version counter would reject it, and would be answering a question nobody asked.
