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
`yarn review:obligations:check`, which fails nothing for it.

The same script does fail on two things, and neither is a finding
([ADR 0078](../adr/0078-a-citation-that-does-not-match-its-source-is-a-fact-about-the-pipeline.md)):
an answer that meets its entry's own defect condition while raising nothing,
and a **citation that does not match its source**. Every answer field that
makes a claim about source carries the file, the line, and the literal text at
that line, and the check reads that line out of the tree at the reviewed head
and compares it. That is what stops an answer from merely asserting: run 45
wrote `slotChild: "Input"` for two sites whose direct child is a positioning
`div`, and nothing compared the writing to anything
([2026-09-10](../research/2026-09-10-the-answer-sheet-is-inert.md)).

The two forms are held together by `yarn review:checklist:check`, which does
fail: it asserts that the entries below carry the same ids, in the same order,
with the same answer fields and the same cited fields as the catalogue. Only that much is mechanical, so
only that much is gated — the rationale and the incident history below are
writing, and a gate over writing is one nobody can satisfy.

This file is indexed in [`CODING_STANDARDS.md`](../../CODING_STANDARDS.md) so a human can find
it, and is deliberately **excluded from the reviewer's standards sources**: its entries reach the
reviewer already selected, never as prose in the brief. That exclusion is written into
[the skill](../../.agents/skills/code-review/SKILL.md) step 3, and it is the whole reason the
selector exists.

## What an entry looks like

Each entry answers five things: when it fires, what must be written down,
which of those answers must quote a line of source, what counts as a defect,
and which incident bought it.

```jsonc
{
  "id": "kebab-case-id",
  "trigger": { "paths": [{ "glob": "libs/**", "addedPattern": "…" }] },
  "question": "What the reviewer must answer, in the imperative.",
  "answerFields": ["…"],
  "citedFields": [{ "field": "…", "uncitedWhen": "none" }],
  "defect": "The comparison that makes the answer a finding.",
  "defectWhen": { "field": "…", "equals": false },
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
- **An answer cites rather than asserts.** Every field naming something the
  reader could go and look at is listed in `citedFields`, and its answer
  carries a `citations` entry — the file, the line, and the literal text at
  that line. `yarn review:obligations:check` compares the quotation to the tree
  at the reviewed head, and a mismatch fails the pipeline check rather than
  producing a finding: a finding is about the diff, and this is about the
  reviewer. A field whose honest answer points at no line at all names that one
  value as `uncitedWhen` — `wiredBy: none` means nothing invokes the gate, and
  nowhere has no line.
- **Entries graduate out.** When an entry's trigger _and_ its defect test are
  both mechanical, it stops being a checklist entry and becomes a wired gate.
  The best outcome for an entry is to leave. Its golden case then retires the
  way `groceries-ui-written-against-absent-roles` did.
- **Skip what a wired gate already fails**, on the condition
  [ADR 0074](../adr/0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md)
  states.
- **`defect` is prose; `defectWhen` is the machine form of the same sentence.**
  Write both, and keep them saying the same thing. `defectWhen` is what lets
  `yarn review:obligations:check` catch an answer that meets its own defect
  condition and raises nothing — which is not a judgment the reviewer gets to
  make, because the entry already decided that answer is a finding. It fires
  only on fields listed in `answerFields`; naming any other field is a load
  error, because a rule that can never fire is worse than no rule.

---

## 1. Run the gate that covers this change

**id** `run-the-gate-that-covers-this-change`
**Fires when** the diff changes the `version` in `package.json`, or touches a
generated or synced output — `libs/app-api-client/**`, `libs/api-specs/**`,
`apps/backend/src/swagger/**` — or a Prisma schema under
`apps/backend/src/prisma/**`, or `libs/design-tokens/src/tokens.json`.

**Answer**

| Field      | What to write                                                                         |
| ---------- | ------------------------------------------------------------------------------------- |
| `gate`     | The checker that covers the changed artifact, e.g. openapi:check.                     |
| `command`  | Optional — what was run, only if you ran something. Write `not run` otherwise.        |
| `exitCode` | Optional — its exit code, only if you ran something. Write `not run` otherwise.       |
| `wiredBy`  | The hook, workflow job, or aggregate manifest entry that invokes the gate, or `none`. |

**Cites** `wiredBy` unless `none`

The citation is the line that does the invoking — the `.husky` hook line, the
workflow `run:` line, or the manifest entry — quoted as it stands at the head
commit. `none` is the one answer with nothing to quote, which is the whole
claim it makes.

Answer `wiredBy` by reading, not running: grep the `.husky` hooks, the
`.github/workflows` jobs, and `tools/scripts/run-assertion-gates.mjs` at the
head commit for the gate's script name, per
[ADR 0074](../adr/0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md).
That answers the obligation this entry exists for on its own, and it costs no
turns. `command` and `exitCode` are the one exception to "an entry answers, it
does not judge" above: earning them means running something, and the
reviewer's tool allowlist does not always grant that. Fill them in only when
you did run the checker, and do it the one way the allowlist permits — the
checker's own script, invoked directly through the interpreter:
`node tools/scripts/check-<name>.mjs`. Not through a package-manager alias:
naming a check script after yarn or corepack yarn is not on the allowlist.
openapi:check in particular is not a bare script at all — it resyncs and can
rewrite files in the checkout, so it is not something a reviewer should run
either way; for the generated-output triggers below, `node
tools/scripts/check-openapi-artifacts.mjs` is the safe, non-mutating check
built for this obligation's own incident (issue #408) and is fine to run.
When you didn't run the gate, write `not run` for both fields; that is a
complete answer, not a missing one.

**Defect** — `wiredBy: none` is a finding: per
[ADR 0074](../adr/0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md)
the checker is not a gate, so nothing would have caught this on `main`. A
non-zero `exitCode`, when one was obtained, is also a finding, with the
command and exit code as executed evidence — raised the ordinary way (see
"An entry answers, it does not judge" above), not mechanically: `exitCode` is
optional, and a plain equality check cannot tell its `not run` value apart
from a real one.

**Why this exists** — issue #408. A release moved `package.json` to 0.4.0
without `openapi:sync`; the generator embeds the version into the spec and every
generated client header, so `openapi:check` failed on `main` from that merge
onward and nothing ran it. The reviewer had permission to run gates and no
instruction naming one. Golden case
`release-bump-leaves-generated-client-stale`, one catch in six attempts.

---

## 2. A destructive confirmation names everything it destroys

**id** `destructive-confirmation-names-what-it-mutates`
**Fires when** an added line contains `window.confirm(`, an `AlertDialog`, or
the text "Are you sure". Nothing else — the trigger is three literal strings,
and this entry documents exactly what the selector matches.

**Answer**

| Field              | What to write                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `mutates`          | Every persisted key, store, or record the confirmed path writes or clears. Follow the call, do not guess from the handler name. |
| `confirmationText` | The message shown to the user, verbatim.                                                                                        |
| `namesEverything`  | `true` only if every item in `mutates` is recognisable from the text.                                                           |

**Cites** `confirmationText`

Quote the line the message starts on. `mutates` is a walk across a call path
rather than a claim about one line, so it carries no citation.

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

**Cites** `slotChild`

Quote the direct child's own line — the line under `<FormControl>`, not the
`<FormControl>` line. This is the field run 45 answered falsely on exactly the
two sites where the truthful answer produces a finding.

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

**Cites** `assignedExpression`

Quote the assignment line. `runtimeValue` is what the setter does with it,
which is a fact about JavaScript rather than about a line in this repository.

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

- **A destructive handler reachable from a confirmation.** Entry 2 fires on
  the three confirmation literals, which misses a handler named `delete…`,
  `replace…`, `reset…` or `restore…` that reaches a confirmation indirectly.
  Catching those needs reachability, not a regex: a name-only trigger fires on
  every `deleteRow` in the codebase, and a trigger that fires everywhere
  teaches the reviewer to ignore it — the failure this file exists to avoid.
  Held until the selector can walk call sites rather than lines.
- **New persisted state has an inverse.** A write path added — a bookmark, a
  cached ETag, a sync marker — without the restore, reset, or import path that
  clears it. Issue #617: per-type Sync Bookmarks held the last pushed ETag and
  `importVault` was left untouched, so a restored older vault hashed as unsent
  while the bookmark's `If-Match` still matched, and old ciphertext was pushed
  over newer data on every device. Golden case
  `sync-bookmarks-without-restore-or-meta-push`, never caught, and **parked**
  rather than replayed with the other six (ADR 0072's amendment;
  `tools/config/review-golden-set.json`, `parked`). Held back because its
  trigger is the hardest to state precisely, and a vague trigger fires
  everywhere and teaches the reviewer to ignore it. This is that case's
  re-entry condition: it returns to the replayed set the day this entry is
  promoted into `tools/config/review-obligations.json`.

## Maintaining this file

Add an entry when an incident gets past review and you can state the question
that would have caught it. Remove one when it graduates to a gate. Keep the
`seededFrom` and `goldenCase` fields accurate — they are what make the list
evidence rather than opinion, and they are how its entries get scored.
