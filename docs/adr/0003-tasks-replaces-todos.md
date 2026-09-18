# Tasks replaces Todos

The existing `Todo` entity (`{ id, todo }`, vault blob type `'todos'`) was too thin to support the task-management workflows users need. Rather than adding a richer `Task` entity alongside `Todo` and splitting "things to do" across two features, we replaced `Todo` entirely with `Task`. The `'todos'` vault blob type is auto-migrated to `'tasks'` on the user's first visit to the Tasks page. The first-visit path writes `'tasks'` and does not delete `'todos'`, so a leftover `'todos'` row next to `'tasks'` is normal after migrate. The `Todo` domain term, page, and Prisma model are gone.

## Status

accepted. Amended 2026-09-18 (issue #538): the `'todos'` plumbing's exit criterion is a zero-row query plus a prior warning release, not "confidence".

## Decision

The user-facing replacement stands. What this amendment decides is **when the leftover `'todos'` read path may be deleted**.

The auto-migration path (`todos` → `tasks`) stays until **both** of the following are true. Each is a fact, not a feeling:

1. **Unmigrated live Ciphertext is zero.** In every environment that stores user vaults, the count of `EncryptedVaultBlob` rows with `type = 'todos'` whose `userId` has no row with `type = 'tasks'` is `0`. The predicate is the Prisma model in `apps/backend/src/prisma/schema/vault.prisma`; it does not decrypt. An operator records the query, the environment, the date, and the count on the cleanup issue. CI cannot see production, so this is not a repo gate.
2. **A warning release has already shipped.** A published release whose notes warn that `'todos'`-only Local Vaults and export files will stop being readable in a later release exists before the removal. The removal does not land in that same release. Local-only Ciphertext and old export files are invisible to query (1); the warning is how that residual is made a communicated fact rather than "confidence".

When both hold, the plumbing is removed in **one change**: client migrate/read/export/import, `VaultBlobType.Todos`, the `VAULT_BLOB_FIELDS` pin, the backend `VAULT_BLOB_TYPES` list, and leftover `type = 'todos'` rows whose owner already has `type = 'tasks'`. Leftover rows next to a `tasks` blob are superseded copies, not unmigrated user data; deleting them as part of that change is what leaves no `'todos'` Ciphertext unreadable. Deleting a `'todos'` row whose owner has no `'tasks'` row remains forbidden.

Query (1) matching the current schema:

```sql
SELECT COUNT(*)::int AS unmigrated_todos
FROM "EncryptedVaultBlob" t
WHERE t.type = 'todos'
  AND NOT EXISTS (
    SELECT 1
    FROM "EncryptedVaultBlob" k
    WHERE k."userId" = t."userId"
      AND k.type = 'tasks'
  );
```

## Considered Options

- **Coexist**: keep `Todo` as a lightweight quick-capture entry point and add `Task` as a separate richer entity. Rejected because both represent "a thing to do" — two features with the same semantic purpose creates confusion and splits the user's attention.
- **Leave the original "confidence is high" clause.** Rejected. It is not a predicate. Nothing in the tree can become true or false because of it, so the plumbing cannot be retired and cannot be proven necessary either.
- **A calendar sunset with no query.** Rejected. A date can fire while unmigrated server rows still exist. That is silent, permanent loss of Ciphertext — the failure [ADR 0033](0033-local-vaults-are-user-owned-and-never-silently-destroyed.md) forbids and that [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) already paid for in groceries.
- **Keep the path permanently.** Rejected. `'todos'` is a member of `VaultBlobType` and therefore of `VAULT_BLOB_FIELDS` ([ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)). Every fan-out pays for a type nothing writes. Retirement was the original consequence; this amendment only makes it checkable.
- **Gate only on "no `'todos'` rows at all".** Rejected as the _start_ condition. After a successful migrate, `saveTasks` writes `'tasks'` and does not have to delete `'todos'`, so migrated users commonly still hold a leftover `'todos'` row. That leftover is not the data-loss case. The data-loss case is `'todos'` with no `'tasks'`. Total `'todos'` row count reaching zero is a _post-condition of the cleanup_ (leftover delete included), not the signal that cleanup may begin.
- **A new ADR that supersedes this one.** Rejected. The decision is still "Tasks replaces Todos". Only the exit criterion was undecidable. Amend, do not replace.

## Consequences

- Any code referencing `VaultBlobType = 'todos'`, the `Todo` interface, or `normalizeTodos()` must be removed or replaced — except the auto-migration path, which remains until the two conditions above hold.
- The cleanup is follow-up issue [#841](https://github.com/mnaimfaizy/myorganizer/issues/841), not this amendment. It is blocked on operator evidence for query (1) and on a warning already present in a shipped release's notes. It routes the API contract change through `backend-api-contract-change`.
- `docs/vault/*.html` keep showing `'todos'` until the type is gone; `yarn vault:pages:check` asserts them against the live pin.
- Marketing copy is not this path. The landing page already says Encrypted Tasks, matching [CONTEXT.md](../../CONTEXT.md) (Todo is listed under _Avoid_ for **Task**).
