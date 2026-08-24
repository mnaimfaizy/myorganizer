# Mobile Numbers Page Agent Guide

## Scope

Dashboard mobile numbers page backed by the encrypted vault, plus the Mobile Number detail route at
`/dashboard/mobile-numbers/[id]`.

## Why this page keeps a detail route

Add and edit forms across the dashboard are summoned into a dialog or sheet, and a route may not
exist solely to host a form ([ADR 0037](../../../../docs/adr/0037-add-edit-forms-are-summoned-not-routed.md)).
`/dashboard/mobile-numbers/[id]` is kept anyway, and the reason is the **child collection**, not the
size of any form: the detail route owns the Usage Locations table. A Usage Location is one line on a
change-of-number checklist ([CONTEXT.md](../../../../CONTEXT.md)) — the organisation to notify, how
to reach them, and whether it has been done yet — so this page is the primary work surface, not a
decorated read-only view. Delete the table's home and the checklist has nowhere to live.

This mirrors the [Addresses page](../addresses/AGENTS.md), which follows the same rule for the same
reason. The one deliberate divergence: the add-Mobile-Number form is a `Dialog`, not a `Sheet`. The
add-Address form is a `Sheet` because it is large (label, property number, street, suburb, state, zip,
country); the add-Mobile-Number form has three fields (label, country code, phone number) and fits a
`Dialog` without the multi-step treatment addresses needs. That is a container choice made from form
size, not a rule about this page.

## Do

- Store mobile number entries and usage locations inside the `mobileNumbers` encrypted blob.
- Keep validation and display logic in this page library.
- Summon add and edit forms as dialogs on the page that holds the record. Add and edit differ by
  prop, not by route or query parameter.
- Keep dialog open state in client state only — no query parameter, no intercepting or parallel
  routes.
- Confirm both deletions through the shared `ConfirmDeleteDialog`. Deleting a Mobile Number destroys
  every Usage Location attached to it, so its confirmation says how many.

## Do Not

- Do not add plaintext mobile number storage or APIs.
- Do not add a route whose only content is a form.
- Do not auto-open a dialog across a navigation. A freshly created Mobile Number lands on an empty
  Usage Locations table, and that empty state is its own call to action.
