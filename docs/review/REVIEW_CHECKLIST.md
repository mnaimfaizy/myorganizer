# Review checklist

One artifact, two readers.

A **human** reviewing a change reads this file top to bottom and answers the
questions that apply. An **agent** reviewing a change never reads it whole: a
selector matches each entry's trigger against the diff and hands the reviewer
only the entries that fired, with the hunks attached. Same questions, same
answers, different delivery.

That split is the point. Every entry here was written because a real incident
got past review, and the record shows that adding another instruction to the
Standards brief does not produce a catch —
[2026-09-07](../research/2026-09-07-golden-replay-baseline.md) and
[2026-09-09](../research/2026-09-09-wired-gate-qualifier-replay.md) both measured
that. An entry is not an instruction to remember. It is a **question that must
be answered in writing**, about a hunk the selector already found, so that
noticing is nobody's job.

## Status

**Wired.** `tools/config/review-obligations.json` is the machine form of the four
entries below, matched against the diff by
`yarn review:obligations:select` before the reviewer runs, and answered into
`tmp/code-review/obligations.answers.json`. Completeness is reported by
`yarn review:obligations:check`, which fails nothing.

This file is indexed in [`CODING_STANDARDS.md`](../../CODING_STANDARDS.md) so a human can find
it, and is deliberately **excluded from the reviewer's standards sources**: its entries reach the
reviewer already selected, never as prose in the brief. That exclusion is written into
[the skill](../../.agents/skills/code-review/SKILL.md) step 3, and it is the whole reason the
selector exists.

## What an entry looks like

Each entry answers four things: when it fires, what must be written down, what
counts as a defect, and which incident bought it.

```jsonc
{
  "id": "kebab-case-id",
  "trigger": { "kind": "regex", "paths": ["libs/**"], "pattern": "…" },
  "question": "What the reviewer must answer, in the imperative.",
  "answerFields": ["…"],
  "defect": "The comparison that makes the answer a finding.",
  "seededFrom": "#123",
  "goldenCase": "case-id",
}
```

Rules that keep the list honest:

- **Every entry cites an incident.** No entry is added because it sounds
  prudent. A checklist grown from speculation is the brief that did not work.
- **An entry answers, it does not judge.** The question asks for facts already
  in the code — what a path mutates, what a value becomes at runtime. The
  defect falls out of comparing two written answers, not from spotting it.
- **Entries graduate out.** When an entry's trigger _and_ its defect test are
  both mechanical, it stops being a checklist entry and becomes a wired gate.
  The best outcome for an entry is to leave. Its golden case then retires the
  way `groceries-ui-written-against-absent-roles` did.
- **Skip what a wired gate already fails.** Per the finding contract, that is a
  suppressed count, not a finding — but only when a hook or a workflow actually
  invokes the checker.

---

## 1. Run the gate that covers this change

**id** `run-the-gate-that-covers-this-change`
**Fires when** the diff changes the `version` in `package.json`, or touches a
generated or synced output — `libs/app-api-client/**`, `libs/api-specs/**`,
`apps/backend/src/swagger/**` — or a Prisma schema under
`apps/backend/src/prisma/**`, or `libs/design-tokens/src/tokens.json`.

**Answer**

| Field      | What to write                                                       |
| ---------- | ------------------------------------------------------------------- |
| `gate`     | The checker that covers the changed artifact, e.g. `openapi:check`. |
| `command`  | Exactly what was run.                                               |
| `exitCode` | Its exit code at the head commit.                                   |
| `wiredBy`  | The hook or workflow that invokes it, or `none`.                    |

**Defect** — a non-zero exit is a finding, with the command and exit code as
executed evidence. Exit 0 with `wiredBy: none` is also worth saying: the
checker is not a gate, so nothing would have caught this on `main`.

**Why this exists** — issue #408. A release moved `package.json` to 0.4.0
without `openapi:sync`; the generator embeds the version into the spec and every
generated client header, so `openapi:check` failed on `main` from that merge
onward and nothing ran it. The reviewer had permission to run gates and no
instruction naming one. Golden case
`release-bump-leaves-generated-client-stale`, one catch in six attempts.

---

## 2. A destructive confirmation names everything it destroys

**id** `destructive-confirmation-names-what-it-mutates`
**Fires when** the diff contains `window.confirm(`, an `AlertDialog`, the text
"Are you sure", or a handler whose name contains `delete`, `replace`, `reset`,
or `restore` and which is reachable from a confirmation.

**Answer**

| Field              | What to write                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `mutates`          | Every persisted key, store, or record the confirmed path writes or clears. Follow the call, do not guess from the handler name. |
| `confirmationText` | The message shown to the user, verbatim.                                                                                        |
| `namesEverything`  | `true` only if every item in `mutates` is recognisable from the text.                                                           |

**Defect** — `namesEverything: false`. Also a finding: a whole-vault or
whole-account destructive action behind a bare `window.confirm` rather than a
dialog the user can read properly.

**Why this exists** — issue #657. Vault import replaced the local vault _and_
`wrapped_mk_passphrase` _and_ `kdf_salt` behind
`window.confirm('Importing will replace your current local vault data.
Continue?')`. A user could accept and lose access, because the message named
the data and not the credentials. Golden case
`import-confirm-is-bare-window-confirm`, first caught 2026-09-09 after several
misses.

---

## 3. Injected props land on the control, not on a wrapper

**id** `slot-injected-props-land-on-the-control`
**Fires when** a changed file renders `FormControl`, or any Radix component
built on `Slot` that forwards props to its single child.

**Answer**

| Field                | What to write                                                     |
| -------------------- | ----------------------------------------------------------------- |
| `slotChild`          | The element that is the direct child of the Slot-based component. |
| `propsLandOn`        | Where `id`, `aria-describedby` and `aria-invalid` end up.         |
| `isFocusableControl` | Whether that element is the input the user focuses.               |

**Defect** — `isFocusableControl: false`. A positioning `div` between
`FormControl` and its `Input` silently moves the label association onto the
div, and the input is announced by its placeholder or not at all.

**Why this exists** — issue #525. The sign-up form wrapped both password inputs
in a positioning div for the show/hide button, so `Slot` injected the
accessibility props onto the div. Both fields were announced by their bullet
placeholder with no label association. Golden case
`signup-password-wrapper-inside-formcontrol`, never caught.

---

## 4. An environment assignment stores what it looks like it stores

**id** `env-assignment-runtime-value`
**Fires when** the diff assigns to `process.env.<KEY>`.

**Answer**

| Field                | What to write                                                 |
| -------------------- | ------------------------------------------------------------- |
| `assignedExpression` | The right-hand side, as written.                              |
| `runtimeValue`       | The value actually stored after the setter coerces it.        |
| `matchesIntent`      | Whether that is what the surrounding code reads as intending. |

**Defect** — `matchesIntent: false`. The common shape: assigning `undefined` or
`null` to unset a variable. The `process.env` setter coerces to string, so the
key is set to the literal `"undefined"`, which is truthy. `delete` is what
unsets it.

**Why this exists** — issue #409. The mail sender's test setup wrote
`MAIL_USERNAME` and `MAIL_PASSWORD` as `undefined` to configure no SMTP auth,
so the transport was built with `auth: { user: 'undefined', pass: 'undefined' }`
while the code read as configuring none. Golden case
`mail-test-setup-assigns-undefined-to-env`, never caught.

---

## Deferred candidates

Real, incident-backed, and deliberately not in the first cohort. The first
measurement needs a small list; a long one repeats the mistake this file exists
to avoid. Promote them once the four above have been measured.

- **New persisted state has an inverse.** A write path added — a bookmark, a
  cached ETag, a sync marker — without the restore, reset, or import path that
  clears it. Issue #617: per-type Sync Bookmarks held the last pushed ETag and
  `importVault` was left untouched, so a restored older vault hashed as unsent
  while the bookmark's `If-Match` still matched, and old ciphertext was pushed
  over newer data on every device. Golden case
  `sync-bookmarks-without-restore-or-meta-push`, never caught. Held back
  because its trigger is the hardest to state precisely, and a vague trigger
  fires everywhere and teaches the reviewer to ignore it.

## Maintaining this file

Add an entry when an incident gets past review and you can state the question
that would have caught it. Remove one when it graduates to a gate. Keep the
`seededFrom` and `goldenCase` fields accurate — they are what make the list
evidence rather than opinion, and they are how its entries get scored.
