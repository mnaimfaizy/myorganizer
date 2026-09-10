# The first replay with obligations: one new catch, and half the run lost

Frozen 2026-09-09. Numbers live in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md);
this brief does not move.

## What ran

Run [34351285079](https://github.com/mnaimfaizy/myorganizer/actions/runs/34351285079)
at `3519bc9c` is the first replay in which the obligation worklist reached the
reviewer: `tools/config/review-obligations.json` matched against each case's
own diff by `select-obligations.mjs`, inside the shared reviewer action so the
replay sees it too.

It is also the first replay that ran at all after the selector landed. Commit
`dd8da1df`, which shipped the selector, skipped its own measurement: the
`[skip replay]` matcher read the whole commit message and fired on the marker
inside the sentence "No [skip replay]: … the replay is the measurement". That
was fixed in `3519bc9c` by reading the subject line only.

## What it found

Four cases produced a scorable result. Three did not run to completion.

| Case                                          | Result                            |
| --------------------------------------------- | --------------------------------- |
| `groceries-blob-type-without-fanouts` (guard) | caught — nine of nine             |
| `signup-password-wrapper-inside-formcontrol`  | **caught, first time in any run** |
| `export-envelope-drops-tasks`                 | miss                              |
| `sync-bookmarks-without-restore-or-meta-push` | miss                              |
| `release-bump-leaves-generated-client-stale`  | void                              |
| `import-confirm-is-bare-window-confirm`       | void                              |
| `mail-test-setup-assigns-undefined-to-env`    | void                              |

**The three voids are rate-limit lockouts, not misses.** The action's
rate-limit detector said so in as many words for
`mail-test-setup-assigns-undefined-to-env`:

> case mail-test-setup-assigns-undefined-to-env was cut off by the subscription
> rate limit and measured nothing; do not record it as a miss

The other two failed at the same step, in the same shape, inside the same
window (12:48–13:01), and the repository owner independently hit their own
subscription limit at that time — the CI reviewer authenticates with
`CLAUDE_CODE_OAUTH_TOKEN`, a subscription token, so an interactive session and
the replay draw on one budget. Only the `mail-test-setup` lockout is proven
from its log; the other two are inferred from shape and timing and should be
treated as void on the same precautionary rule the detector exists to enforce.

## The one result worth arguing about

`signup-password-wrapper-inside-formcontrol` had never been caught. It was
caught here, in the first run where the `slot-injected-props-land-on-the-control`
obligation fired on its site and asked the reviewer to name the direct child of
the Slot-based component and say whether that element is the focusable control.
Answering that question is answering the incident.

That is a mechanism, and it is what distinguishes this catch from the previous
run's first catch of `import-confirm-is-bare-window-confirm`. That one arrived
under a brief change about gate suppression, which has no path by which it
could reach a `window.confirm` message; it was recorded as variance and should
stay recorded that way. This one has a direct path from the intervention to the
finding.

**It is still one run.** The record's own lesson is that a single run moves a
case in either direction and settles nothing, and this run's per-case outcomes
remain consistent with the ~0.2 hit rate the last three full runs describe. One
catch with a mechanism is a reason to run the experiment again, not a result.

**And the two cases that would have tested the mechanism hardest did not run.**
`import-confirm` and `mail-test-setup` both have obligations firing directly on
their sites, and both were rate-limited. The strongest available evidence for
or against the design was not collected.

## What this run does not measure

The triggers it ran under were wrong in two ways the CI reviewer found on the
same head, with executed evidence, after the run started:

- the gate obligation fired on any `package.json` edit rather than a version
  line, so cases touching `package.json` for unrelated reasons were asked a
  question the checklist never claimed they would be;
- the destructive-confirmation entry documented a handler-name clause its regex
  never implemented.

Both are corrected in `c074add8`, along with a move of
`check-obligation-answers.mjs` to `tools/scripts/` so `gates:coverage:check`
can see it — in its previous home the Meta-Gate's non-recursive scan skipped
it, which is exactly the "checker nothing runs" shape
[ADR 0074](../adr/0074-a-gate-suppresses-a-finding-only-if-something-runs-it.md)
names.

So the corrected selector is **unmeasured**. The next replay should be
dispatched deliberately, on a settled head, when the subscription budget can
carry seven sessions — not carried by a pull request that is still being
edited, and not started while an interactive session is consuming the same
quota.

## What to do with the answer sheets

Nothing in this run's artifacts has been read for whether the reviewer actually
wrote `tmp/code-review/obligations.answers.json`, or whether the obligations
that fired were answered. That is the three-way split the sidecar was built to
produce — not selected, selected but unanswered, answered with no finding — and
it is more informative than the recall number. Reading it needs the per-case
artifacts, and it is the first thing to do with the next run.
