# The answer sheet is inert: run 45 read from the transcripts

Frozen 2026-09-10. Numbers live in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md);
this brief does not move.

## What ran

Run [34441162698](https://github.com/mnaimfaizy/myorganizer/actions/runs/34441162698)
at `3903a0e2`, dispatched deliberately with `tier=all` — the first replay fired
by `workflow_dispatch` rather than carried by a push, and the first to measure
the corrected obligation triggers (`c074add8`, `c6f7117c`), the sharpened
ADR 0074 item 3 (`8a2872c1`), and the shared glob compiler (`cbb91833`).

| Case                                          | Result                                |
| --------------------------------------------- | ------------------------------------- |
| `release-bump-leaves-generated-client-stale`  | catch                                 |
| `mail-test-setup-assigns-undefined-to-env`    | catch — never caught in any prior run |
| `signup-password-wrapper-inside-formcontrol`  | miss                                  |
| `import-confirm-is-bare-window-confirm`       | miss                                  |
| `export-envelope-drops-tasks`                 | miss                                  |
| `sync-bookmarks-without-restore-or-meta-push` | miss                                  |
| `groceries-blob-type-without-fanouts` (guard) | **void — turn exhaustion**            |

Two of six scored. The guard case is void and **must not be demoted**: see
"A third outcome" below.

## The finding: an obligation can be answered and still miss

The two obligation-covered misses were read from their reviewer transcripts,
which the repository owner supplied by hand. Both are decisive, and they rule
out every diagnosis that had been proposed.

`signup-password-wrapper-inside-formcontrol`. The selector fired on all seven
`FormControl` sites in the file, **including lines 232 and 267 — the two the
incident is about**. The reviewer wrote an answer for every one. For 232 and
267 it wrote:

```json
{ "slotChild": "Input", "propsLandOn": "Input", "isFocusableControl": true }
```

The source at those lines:

```
232 |                <FormControl>
233 |                  <div className="relative">
234 |                    <Input
```

The direct child is a positioning `div`. The answer says `Input`. Its answers
for the five non-password sites are correct, so the question was understood and
the format was understood. Five sites answered truthfully, two falsely, and the
two false ones are exactly the sites where the truthful answer produces a
finding.

`import-confirm-is-bare-window-confirm` is the mirror image. It answered
`namesEverything: false` — the correct answer, and the one its own `defect`
field calls a finding in as many words — with an accurate `mutates` naming the
wrapped-key overwrite. Then it left `raisedFindingIds: []` and reported
nothing.

So:

- **not a trigger failure** — the selector found the defective lines;
- **not an enforcement failure** — `obligations.answers.json` was written, every
  site covered;
- **not a wording failure** — the question is right, and was answered correctly
  elsewhere in the same sheet.

**A written answer is not a verified answer.** The obligation design assumed
that forcing a fact into writing would surface the defect. It does not, because
nothing compares the writing to anything. `checkAnswers` tested that fields were
present and non-blank — hardened hours earlier in `cbb91833` — and presence was
never the weak point. `"Input"` is a perfectly non-blank string, and the
completeness report called the `import-confirm` sheet **complete**.

## What was built in response

The cheaper half of the gap needs no source access at all. An answer that
satisfies its own declared defect condition while raising no finding
contradicts itself, inside one file, with nothing else to consult.

`defectWhen` is the machine form of the prose `defect` field — a deliberately
tiny grammar of `all`, `any`, and a field compared for equality, because a
predicate language rich enough to express judgment would be a second reviewer.
`checkAnswers` now reports `contradictions`, and
`yarn review:obligations:check` exits 1 on them. Replaying run 45's real
`import-confirm` sheet through it reports the contradiction that run missed.

A `defectWhen` naming a field outside `answerFields` is a load error: a rule
that looks present and can never fire is the silent no-op shape this repository
keeps rediscovering.

**What it does not do** is catch `signup`. Detecting `slotChild: "Input"` where
the source says `div` requires reading the source, which is a different and
much larger checker. That half is unbuilt, and the honest description of the
obligation design today is that it forces an answer and verifies only the
answers that contradict themselves.

**Whether a contradiction should block is undecided.** It is arguably an
`Agent Review Ran` failure in the ADR 0073 sense, beside "wrote a report the
contract rejected" — but that is a required-check semantics decision, so
`continue-on-error: true` stays on the workflow step until it is made
deliberately. Removing that one line is the whole change.

## A third outcome the apparatus had no word for

`groceries-blob-type-without-fanouts` — the guard case, nine of nine in run 37 —
failed with `"subtype": "error_max_turns"`, `num_turns` 81,
`permission_denials_count` 26, and the rate-limit detector correctly reporting
`rate_limited=false`. It is neither a lockout nor a miss: the reviewer never
wrote a report at all.

ADR 0072 demotes a guard case on one miss. Scoring turn exhaustion as a miss
would demote a case the reviewer never failed — the same error the rate-limit
void rule exists to prevent, arriving through a different door. It is recorded
**void**, and the detector step should learn `error_max_turns` as its own
non-miss outcome. The 26 permission denials burned roughly a third of the turn
budget and are the probable cause; which tools were refused is in the transcript
artifact.

## What this run does not measure, and why

The three-way split the sidecar was built to produce — not selected / selected
but unanswered / answered with no finding — was **not collectable from the
replay**. `review-golden-replay.yml` uploaded only `normalized.json` and
`score.json`; the obligation files were added to `code-review.yml` in
`c6f7117c` and never to the replay, which is where the measurement happens. The
same oversight as the path-filter gap the CI reviewer caught on `8a2872c1`: the
obligations were wired into the review pipeline and only half into the replay.
Fixed here, too late for this run. The evidence above exists only because the
raw transcripts were downloaded by hand before their seven-day expiry.

## The claim this brief retracts

[2026-09-09](2026-09-09-first-obligations-replay.md) recorded run 37's catch of
`signup-password-wrapper-inside-formcontrol` as having "a direct path from the
intervention to the finding", and distinguished it from the previous run's
`import-confirm` catch on that basis. **That distinction does not survive.** In
run 45 the same obligation fired on the same lines and the case missed, and the
transcript shows the mechanism reached the reviewer intact and was answered
falsely. Run 37's catch is one observation, indistinguishable from the
`import-confirm` catch it was contrasted with, and both are consistent with the
~0.2 hit rate the record already described.

A correlation was also briefly drawn here between corrected triggers (2 for 2)
and untouched ones (0 for 2). It is four points, and the transcripts confound
it: `signup`'s trigger was already aiming correctly. It is recorded as an
observation, not a result.
