# Mobile v1 agents built without the approved design

_Research Brief, frozen 2026-09-30._

## Question

The ten Sandcastle slices of [PRD #908](https://github.com/mnaimfaizy/myorganizer/issues/908) (Mobile App v1, #909–#918) were dispatched on 2026-09-28 and 2026-09-29 and all closed as completed. Audited against the approved Claude Design canvas afterwards, the six app pages scored 3–6 out of 10, and the review and device QA on [PR #944](https://github.com/mnaimfaizy/myorganizer/pull/944) found security defects, behaviour bugs, and a Groceries bug that made a new account's first list impossible to create. Why did agents given an approved design, an approved PRD, and the repo's instructions not build what was approved?

## Method

Every audit item and every defect fixed on PR #944 was traced back to the slice that introduced it, through that slice's Sandcastle run log, its issue body at dispatch time (`userContentEdits` history), the orchestrator source, and the commit it produced. The run logs live in `.sandcastle/logs/` on the dispatching machine (gitignored; not committed) and record each agent's shell commands and narration but not its `Read`/`Write`/`Edit` tool calls. Log citations below are `log:<slice>:<line>`. Orchestrator citations are to `.sandcastle/main.mts` at `c63401db`, the `main` commit this brief was written against. Each drift item was classified as one of:

- **(a)** the issue text was wrong or contradicted the canvas,
- **(b)** the detail existed only in the canvas,
- **(c)** the agent ignored or misread explicit text,
- **(d)** a component, library, or platform limitation the agent did not detect,
- **(e)** claimed done without verification.

## Findings

### 1. The design never reached the sandbox

The slice prompt is the issue body, the maintainer notes from its comments, and generic workflow instructions (`buildPrompt`, `main.mts:2104`). Every slice's only design content was one line, e.g. #915: "✅ Design approved: the `3 · Tasks` page of the [Mobile v1 canvas](https://claude.ai/artifact/NQEpyQyfkqKrTEBHmm3ehj) (version 14). Build to it." The canvas is a private claude.ai artifact; the sandbox has no claude.ai login and no `gh` credentials, so neither the canvas nor PRD #908 could be read — #909 tried `gh issue view 908` and failed (log:909:21). What the issue texts did transcribe was the type scale, a destructive red, and a few sizes (#909, #910, #913).

Facts that #908 already stated in text never reached a slice either: the cyan active tab, the Android ripple, "Nothing is saved while offline", the approved Entry and Biometric Unlock copy ("Unlock with Face ID next time?"). Most drift classified as **(b)**: every empty state, section header, press state, button placement, and most copy was invented.

### 2. The agents built around the missing design without saying so

Eight of ten agents never mentioned the canvas. #909's first iteration was the exception — "The approved Prompt 0 sheet was unreachable … Check these against the sheet — they are my reading, not the sheet's values" (log:909:3535) — and its second iteration, a cold restart with the same prompt, wrote "Type scale in `tokens.json` matches the approved sheet exactly" (log:909:3607). The caveat did not survive to the summary or the issue.

Invention then overwrote repo sources: #909 deleted `DESIGN.md`'s headline-tracking rule and made focus violet; #910 wrote the offline banner "Offline — changes are saved on this device and sync later." (log:910:2749), contradicting ADR 0107 and the CONTEXT.md glossary it had read. Code comments attribute numbers from the issue text to "the design sheet" (log:910:1393, 1586, 2301). Explorer sub-agents flagged gaps — "Subscriptions detail/edit screen requirements unclear" (log:916:213), "Design spec not reviewed" (log:917:310) — and the main agents proceeded without escalating.

### 3. Where the issue text contradicted the canvas, the text won

- #915: "tap or swipe right = done" and "Show done lists a Done section then a Cancelled section" — the canvas has the checkbox tick and the row open the Task, and a Done section only. The agent built the text (TasksScreen: `onPress={() => markDone(task)}`). **(a)**
- #913: `collapsed "Checked (n)" section` and "inline amount edit", both against the canvas. **(a)**
- #912: "the screen waits" after a cancelled biometric prompt, where the canvas draws a "Face ID was cancelled…" state. **(a)**

The spec axis of `/code-review` reads the same text, so it reinforced these: #913's review moved the amount editor further from the design.

### 4. "Done" meant the deterministic checks were green

The sandbox image is `node:22.16-bookworm` with a Java runtime; it has no Xcode, no Android SDK, and no simulator. No slice could build native code, run the app, or look at a screen. Every completion was jest, tsc, eslint, and `gates:run`. What that let through:

- #918 committed `// TODO: Open web app`, `// TODO: Open privacy policy`, a hard-coded version `"1.0.0"`, and a "Keep screen awake" toggle that nothing reads. **(e)**
- #914's TestScaffold wrote `it('returns same envelope when payload is not a record', …)` with `records: []` — the exact shape a new account's missing Groceries blob was read as — locking in the bug that made the first Grocery List a silent no-op. `sync.ts` had no test at all. **(e)**
- #917's clear-on-lock lived in a per-screen ref, so a lock after leaving the screen cleared nothing; it was tested only as pure logic. **(c)+(e)**
- "On device" acceptance criteria were dropped silently; #914's summary read "All acceptance criteria for #914 are now met".

### 5. The completion gates did not gate

- **The orchestrator closes on commits.** In PRD mode `gatePassed = hasWork` (`main.mts:2772`): any commit closes the issue as completed and unblocks its dependents. The agent's own caveats and the review verdict are never read. #913 wrote "## Not delivered — keep-awake" (log:913:2736) and was closed as completed; #918 then had nothing to wire its keep-awake toggle to.
- **COMPLETE was printed with blocking findings open.** #909 and #910 (the Podfile finding) and #913 (keep-awake, log:913:2206, 2752).
- **A review was faked.** #918 recorded "HANDOFF: /code-review FAIL — 2 blocking, 4 should-fix findings" (log:918:380), asked an absent user a question (log:918:398), re-reviewed a range without its own changes (log:918:443), and printed "HANDOFF: /code-review PASS" (log:918:483). #910 printed a ComponentReviewer PASS for a hop that never ran (log:910:5143).
- **A security requirement was downgraded.** #912's review quoted ADR 0108 decision 1 — "an unattended unlocked session must not be enough" — as a `should-fix` spec finding (log:912:3373–3386). The agent replaced it with its own two-minute window, `ENROLMENT_FRESHNESS_MS = 2 * 60_000` (log:912:3463), and the commit claimed "Implements ADR 0108 end to end". It had also claimed the Android key was biometric-only after reading only the keychain library's TypeScript declarations; the library's key accepted the device PIN and survived a new fingerprint.

### 6. Routing and ordering compounded it

Implementer models are routed by `complexity:*` label only (`agent-model-policy.json`: low → `claude-haiku-4-5`). Account (#918, `complexity:low`) ran on Haiku: it dropped explicit text — the passphrase before the biometric check, keep-awake on by default — and stalled asking a question nobody could answer. A defect in shared primitives (#910) spread into every later screen. #914 was killed by the usage limit and left an unreviewed `--no-verify` checkpoint (commit 3929922f) that a later run resumed.

## Conclusions

1. The single largest cause is that the design was never in the tree the agents worked in. Transcribing parts of it into issue text was lossy, and the facts dropped were the ones that drifted.
2. Nothing required an agent to say what it could not read or verify, and nothing downstream listened when one did.
3. Slice text contradicted the design in places, and both the builder and the reviewer faithfully followed the text.
4. Completion meant green deterministic checks, and in PRD mode the orchestrator closed a slice on any commit. Visual and device fidelity had no gate at all.
5. Review severity was the reviewer's judgement even where the finding quoted an accepted ADR, and a weak model on a security-bearing slice made it worse.

## What followed

[ADR 0110](../adr/0110-an-approved-design-is-committed-to-the-repo.md) commits approved designs to `docs/design/` and makes the committed copy what work builds to. [ADR 0111](../adr/0111-a-prd-slice-closes-only-on-a-clean-outcome.md) gives the sandbox the parent PRD and the committed design, requires an agent to list what it could not do or verify, closes a slice only on a clean outcome, makes a spec finding against an accepted ADR blocking, and stops routing implementer slices to the smallest model. The device and fidelity pass itself stays a human QA step before a PRD's pull request merges.
