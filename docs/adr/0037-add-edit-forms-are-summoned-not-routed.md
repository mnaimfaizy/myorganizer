# Add/edit forms are summoned, not routed

Five dashboard pages had four different ways to open a create/edit form — dialog (`groceries`), side sheet (`addresses`), always-visible inline card (`tasks`, `mobile-numbers`, `subscriptions`), and a dedicated route (`addresses/[id]/add-location`). We standardise on **summoned forms**: an add/edit affordance opens a `Dialog`, or a `Sheet` when the form is multi-step or unusually large. A route may not exist solely to host a form.

## Status

accepted

## Decision

A route survives on the strength of its **content**, not for consistency with its siblings. A route whose only content is a form is deleted once that form becomes a dialog; a route that also owns a child collection is kept, and its edit affordance becomes a dialog on the page.

This deletes `/dashboard/subscriptions/[id]` (its entire content was `EditSubscriptionCard`) and both `/[id]/add-location` routes (pure form routes, already dual-purposed via an `?edit=` query param). It keeps `/dashboard/addresses/[id]` and `/dashboard/mobile-numbers/[id]`, which own the Usage Locations table.

Dialog open state is **client state only**. Back does not close a dialog and a dialog is not deep-linkable.

## Considered Options

- **Route-backed dialogs (`?edit=<id>` drives `open`)** — rejected. That query param is the exact mechanism we are deleting from `add-location`. Every affected page sits behind `VaultGate`, so a deep link lands on an unlock prompt and must then re-resolve the id after decryption — real complexity for a form reopened in one click.
- **Next.js parallel/intercepting routes (`@modal` slots)** — rejected. Adds a route file per dialog, which is the inverse of this decision, and adds Next.js routing machinery against the grain of [ADR 0019](0019-nextjs-proxy-is-not-a-session-layer.md).
- **One container (`Dialog`) everywhere** — rejected. The address and subscription forms are large enough that a dialog with internal scrolling is worse on mobile than a sheet.
- **Delete every detail route for symmetry** — rejected. It would leave the Usage Locations table homeless.
- **Redirects for the three deleted routes** — rejected. No server-generated link points at them: `YouTubeDigestService` builds the only externally-emailed deep links and they all target `/dashboard/youtube`. A stale personal bookmark 404s.

## Consequences

- **`addresses` and `mobile-numbers` are the documented exception**, recorded in their page `AGENTS.md`. The reason is the child collection, not the form's size. A **Usage Location** is one line on a change-of-address checklist ([CONTEXT.md](../../CONTEXT.md)), so the detail page is the primary work surface and the add-address flow keeps a post-save step that sends the User there. No dialog is ever auto-opened across a navigation: the new address's empty Usage Locations table is its own call to action.
- Deleting `add-location` removes its duplicated load/decrypt/not-found machinery; as a dialog on the detail page the record is already decrypted.
- Destructive actions get one `ConfirmDeleteDialog` UI Primitive ([ADR 0026](0026-three-component-scopes.md)). The existing bespoke dialogs in `groceries` and `tasks` are deliberately **not** retargeted onto it — this decision covers the gaps, not a rewrite. `DeleteCatalogItemDialog` stays bespoke because type-the-exact-name is a different interaction.
- A subscription is no longer deep-linkable. Acceptable: it is vault-backed, so no server-side surface ever links to one.
