# Three component scopes: UI Primitive, Feature Component, Vault UI Component

GUIDELINES §1 said a React component lives in exactly two places: `libs/web-ui/` (UI Primitive) or `libs/web/pages/<route>/` (Feature Component). `CloudBackupCard` and `LastBackupCard` in `libs/web-vault-ui` are neither: they know the vault domain, so they are not primitives, and they are reused across routes, so they are not Feature Components.

We name a third scope, **Vault UI Component**: presentational, vault-domain-aware, mock-props-expressible. UI Primitives and Vault UI Components ship with colocated Storybook stories; Feature Components stay out of the glob.

## Status

accepted

## Considered Options

- **Leave GUIDELINES claiming two places** — rejected. The next backup card would be shoved into `web-ui` (domain leak) or a page folder (unshareable).
- **Move the cards into a Feature Component folder** — rejected. More than one route uses them.
- **Promote them to UI Primitives** — rejected. They know backup/restore, which is vault domain.

## Consequences

- Glossary: [CONTEXT.md](../../CONTEXT.md) — UI Primitive, Feature Component, Vault UI Component.
- Story rule: [GUIDELINES.md](../ui/GUIDELINES.md) §1 and [STORYBOOK-PATTERNS.md](../ui/STORYBOOK-PATTERNS.md) §1. Non-UI `web-vault-ui` exports (`session`, `vaultGate`, `migrationRunner`) are not this scope and do not get stories.
