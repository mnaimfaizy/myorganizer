# Tasks replaces Todos

The existing `Todo` entity (`{ id, todo }`, vault blob type `'todos'`) was too thin to support the task-management workflows users need. Rather than adding a richer `Task` entity alongside `Todo` and splitting "things to do" across two features, we replaced `Todo` entirely with `Task`. The `'todos'` vault blob type is auto-migrated to `'tasks'` on the user's first visit to the Tasks page; the old blob is discarded after migration. The `Todo` domain term, page, and normalization layer are removed.

## Considered Options

- **Coexist**: keep `Todo` as a lightweight quick-capture entry point and add `Task` as a separate richer entity. Rejected because both represent "a thing to do" — two features with the same semantic purpose creates confusion and splits the user's attention.

## Consequences

- Any code referencing `VaultBlobType = 'todos'`, the `Todo` interface, or `normalizeTodos()` must be removed or replaced.
- The auto-migration path (`todos` → `tasks`) must remain in place until confidence is high that no user has a `'todos'` blob without a `'tasks'` blob.
