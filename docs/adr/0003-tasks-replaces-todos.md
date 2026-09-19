# Tasks replaces Todos

The existing `Todo` entity (`{ id, todo }`, vault blob type `'todos'`) was too thin to support the task-management workflows users need. Rather than adding a richer `Task` entity alongside `Todo` and splitting "things to do" across two features, we replaced `Todo` entirely with `Task`. The `'todos'` vault blob type was auto-migrated to `'tasks'` on the user's first visit to the Tasks page until issue #841. The first-visit path wrote `'tasks'` and did not delete `'todos'`, so a leftover `'todos'` row next to `'tasks'` was normal after migrate. The `Todo` domain term, page, and Prisma model are gone. `'todos'` is no longer a Vault Blob Type.

## Status

accepted. Amended 2026-09-18 (issue #538): the `'todos'` plumbing's exit criterion is a zero-row query plus a prior warning release, not "confidence". Cleanup landed in issue #841. Amended 2026-09-19 (issue #841): predicate (1) confirmed for production and staging; predicate (2) waived by the maintainer — see _Exit record_.

## Decision

The user-facing replacement stands. The leftover `'todos'` read path is deleted (issue #841): `VaultBlobType` no longer includes `'todos'`, first-visit migrate is gone, and leftover server `'todos'` rows whose owner already has `'tasks'` are deleted by `VaultService.deleteSupersededTodosBlobs` (idempotent; run on backend boot). Deleting a `'todos'` row whose owner has no `'tasks'` row remains forbidden; that SQL uses `EXISTS` on `'tasks'`.

The auto-migration path (`todos` → `tasks`) stayed until **both** of the following were true. Each is a fact, not a feeling:

1. **Unmigrated live Ciphertext is zero.** In every environment that stores user vaults, the count of `EncryptedVaultBlob` rows with `type = 'todos'` whose `userId` has no row with `type = 'tasks'` is `0`. The predicate is the Prisma model in `apps/backend/src/prisma/schema/vault.prisma`; it does not decrypt. An operator records the query, the environment, the date, and the count on the cleanup issue. CI cannot see production, so this is not a repo gate.
2. **A warning release has already shipped.** A published release whose notes warn that `'todos'`-only Local Vaults and export files will stop being readable in a later release exists before the removal. The removal does not land in that same release. Local-only Ciphertext and old export files are invisible to query (1); the warning is how that residual is made a communicated fact rather than "confidence".

When both held, the plumbing was removed in **one change**: client migrate/read/export/import, `VaultBlobType.Todos`, the `VAULT_BLOB_FIELDS` pin, the backend `VAULT_BLOB_TYPES` list, and leftover `type = 'todos'` rows whose owner already has `type = 'tasks'`. Leftover rows next to a `tasks` blob are superseded copies, not unmigrated user data; deleting them as part of that change is what leaves no `'todos'` Ciphertext unreadable. Deleting a `'todos'` row whose owner has no `'tasks'` row remains forbidden.

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

### Exit record (issue #841, 2026-09-19)

| Predicate | Environment | Result | Recorded by |
| --- | --- | --- | --- |
| (1) Unmigrated live Ciphertext is zero | production | `0` | maintainer |
| (1) Unmigrated live Ciphertext is zero | staging | `0` | maintainer |
| (2) A warning release has already shipped | — | **waived** | maintainer |

Predicate (2) was waived, not met. No release carried the warning before the removal. The maintainer accepted the residual it guarded: a `'todos'`-only Local Vault or export file that never reached a server is no longer readable after this change. Query (1) cannot see that residual, so the waiver is a decision, not a measurement.

## Considered Options

- **Coexist**: keep `Todo` as a lightweight quick-capture entry point and add `Task` as a separate richer entity. Rejected because both represent "a thing to do" — two features with the same semantic purpose creates confusion and splits the user's attention.
- **Leave the original "confidence is high" clause.** Rejected. It is not a predicate. Nothing in the tree can become true or false because of it, so the plumbing cannot be retired and cannot be proven necessary either.
- **A calendar sunset with no query.** Rejected. A date can fire while unmigrated server rows still exist. That is silent, permanent loss of Ciphertext — the failure [ADR 0033](0033-local-vaults-are-user-owned-and-never-silently-destroyed.md) forbids and that [#512](https://github.com/mnaimfaizy/myorganizer/issues/512) already paid for in groceries.
- **Keep the path permanently.** Rejected. `'todos'` is a member of `VaultBlobType` and therefore of `VAULT_BLOB_FIELDS` ([ADR 0053](0053-a-fan-out-over-a-domain-enum-is-pinned-at-its-call-site.md)). Every fan-out pays for a type nothing writes. Retirement was the original consequence; this amendment only makes it checkable.
- **Gate only on "no `'todos'` rows at all".** Rejected as the _start_ condition. After a successful migrate, `saveTasks` writes `'tasks'` and does not have to delete `'todos'`, so migrated users commonly still hold a leftover `'todos'` row. That leftover is not the data-loss case. The data-loss case is `'todos'` with no `'tasks'`. Total `'todos'` row count reaching zero is a _post-condition of the cleanup_ (leftover delete included), not the signal that cleanup may begin.
- **A new ADR that supersedes this one.** Rejected. The decision is still "Tasks replaces Todos". Only the exit criterion was undecidable. Amend, do not replace.

## Consequences

- Any code referencing `VaultBlobType = 'todos'`, the `Todo` interface, `normalizeTodos()`, or `migrateFromTodos()` must stay gone.
- `docs/vault/*.html` track the live pin; `'todos'` is no longer a Vault Blob Type.
- Marketing copy is not this path. The landing page already says Encrypted Tasks, matching [CONTEXT.md](../../CONTEXT.md) (Todo is listed under _Avoid_ for **Task**).
