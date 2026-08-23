# Addresses Page Agent Guide

## Scope

Dashboard addresses page backed by the encrypted vault, plus the Address detail route at
`/dashboard/addresses/[id]`.

## Why this page keeps a detail route

Add and edit forms across the dashboard are summoned into a dialog or sheet, and a route may not
exist solely to host a form ([ADR 0037](../../../../docs/adr/0037-add-edit-forms-are-summoned-not-routed.md)).
`/dashboard/addresses/[id]` is kept anyway, and the reason is the **child collection**, not the size
of any form: the detail route owns the Usage Locations table. A Usage Location is one line on a
change-of-address checklist ([CONTEXT.md](../../../../CONTEXT.md)) — the organisation to notify, how
to reach them, and whether it has been done yet — so this page is the primary work surface, not a
decorated read-only view. Delete the table's home and the checklist has nowhere to live.

The add-Address form stays a `Sheet` because it is large; that is a container choice and is **not**
the reason the route survives. Every other form on this surface is a `Dialog` summoned from the page
the record already lives on.

## Do

- Store address entries and usage locations inside the `addresses` encrypted blob.
- Keep validation and display logic in this page library.
- Summon add and edit forms as dialogs on the page that holds the record. Add and edit differ by
  prop, not by route or query parameter.
- Keep dialog open state in client state only — no query parameter, no intercepting or parallel
  routes.
- Confirm both deletions through the shared `ConfirmDeleteDialog`. Deleting an Address destroys
  every Usage Location attached to it, so its confirmation says how many.

## Do Not

- Do not add plaintext address endpoints or server-side search over sensitive fields.
- Do not add a route whose only content is a form.
- Do not auto-open a dialog across a navigation. A freshly created Address lands on an empty Usage
  Locations table, and that empty state is its own call to action.
