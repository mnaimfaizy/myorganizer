# Review Tier intermittent failures (2026-09-18)

Research date: **2026-09-18**. Frozen at that date: the job records and logs
below were read with `gh api` / `gh run view` against
`mnaimfaizy/myorganizer` as they stood that day. Decision context: issue
[#790](https://github.com/mnaimfaizy/myorganizer/issues/790), [ADR 0070](../adr/0070-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md).

## Question

Issue #790 reported that the required Review Tier gate failed on 2 of 13 runs
on 2026-09-15 (~15%), that failing runs took ~160s (guessed as a yarn cache
miss), that job logs 404'd through GitHub MCP, and that one failure presented
as three red checks. It asked four diagnostic questions. What actually failed
on the two cited runs, and which of those questions still need a code change?

## Method

The issue names Review Tier workflow runs 147 and 151 and four job ids. Those
map 1:1 to GitHub Actions run ids `34952437386` (run 147) and `34955049214`
(run 151). For each run: `GET /repos/mnaimfaizy/myorganizer/actions/runs/{id}/jobs`
and `gh run view {id} --log-failed`. For the 404: `GET /repos/…/actions/jobs/{id}/logs`.

A later scan of the most recent 200 Review Tier runs on 2026-09-18 found 197
success, **2 failure** (exactly these two), and 1 cancelled.

## The two failures are different shapes

### Run 151 / job `104334970928` — GraphQL flake after a successful classify

- Run: [34955049214](https://github.com/mnaimfaizy/myorganizer/actions/runs/34955049214)
  (PR #789, HEAD `58c079b`).
- Job `104334970928` name `Review Tier`, `runner_id` set, 11 steps.
- **Restore dependency cache: success. Install dependencies: skipped
  (cache hit). Classify the diff: success.** `LABEL=review:agent`.
- Apply the review tier label: **failure**, ~13s. Log:

  > GraphQL: Something went wrong while executing your query on
  > 2026-09-15T09:55:23Z. Please include
  > `2C02:2330E3:EC780C:110B10D:6AA91601` when reporting this issue.

- After the failed step, GitHub still evaluated job outputs (`Set output
'tier'` / `Set output 'label'`). The classifier had already written them.
- Wall clock ~44s (started 09:54:42Z, completed 09:55:26Z), not ~160s.
- **`gh run view 34955049214 --log-failed` returned the log.** This job is
  one of the four ids the issue listed as unreadable via MCP; the Actions
  log API had the blob.

This is the failure the label-apply retries and `continue-on-error` address.
The required check was failing on a display step (ADR 0070 item 3: the job
output is the truth, the label is a view of it).

### Run 147 / job `104326339851` — no runner, so no log blob

- Run: [34952437386](https://github.com/mnaimfaizy/myorganizer/actions/runs/34952437386)
  (PR #777, HEAD `588a8e5`).
- Job `104326339851` name `Review Tier`, **`runner_id`: 0, `runner_name`:
  empty, `steps`: []**.
- Logs API: HTTP 404 wrapping Azure `BlobNotFound` (`The specified blob does
not exist`). `gh run view 34952437386 --log-failed` → `log not found:
104326339851`.
- Wall clock ~84s (created=started 09:24:59Z, completed 09:26:23Z). No
  step ran, so this is not an install, an `nx graph` call, or the 15-minute
  job timeout.

GitHub never assigned a runner, so it never stored a log blob. Nothing in
`.github/workflows/review-tier.yml` can write a log that was never uploaded.
Granting `actions: read` on the job token does not create that blob, and
MCP 404s on this job because the blob is absent, not because the workflow's
permissions hide it.

### Job `104326383163` is not a Review Tier job

The issue lists this id next to the Review Tier failures. It is **Code
Review** run [34952437428](https://github.com/mnaimfaizy/myorganizer/actions/runs/34952437428)
job name **Agent Review Ran**, same HEAD `588a8e5`, same shape as run 147:
`runner_id` 0, empty `steps`. That is why one SHA showed more than one red
check: two workflows both failed to get a runner, not because Review Tier
left `TIER` empty for Code Review (the two workflows classify independently).

Job `104334970928` (run 151) is the remaining id; it had logs, as above.

## Answers to the four diagnostic items in #790

1. **Cache-miss / install correlation.** Not confirmed. Run 151 hit the
   cache and skipped install. Run 147 never reached the cache step.
2. **Install vs `nx graph` vs timeout.** None of those failed on either
   cited run. Classify succeeded on run 151 (so `nx graph` ran). The
   15-minute job timeout did not fire.
3. **Publish Review / Agent Review Ran cascade from empty `TIER`.** Not
   what happened on these two SHAs. Run 151's Review Tier job still wrote
   outputs. Run 147's pair of red checks are two no-runner jobs. Empty
   `TIER` remains a real path if classify crashes before `finish()`; the
   wrappers in `review-tier.yml` and `code-review.yml` close that path.
4. **Why logs 404.** Per job id, not per workflow:
   - `104326339851` (Review Tier, run 147): no runner → no blob.
   - `104326383163` (Agent Review Ran, same SHA): no runner → no blob.
   - `104334970928` (Review Tier, run 151): blob present; CLI retrieved it.

"Job logs should be readable" holds for every job that actually ran. A job
GitHub never started has no log to make readable.

## What this does not claim

It does not claim GitHub will stop failing to assign runners. That failure
is outside the workflow YAML: a job with `runner_id` 0 never starts, so no
step-level retry inside `review-tier.yml` can run. The operator action for
that shape (run 147 / job `104326339851`) is to re-run the failed job from
the Actions UI. It does not re-attribute the issue's "~160s / ~15%" figures
to install time; those were the issue author's inference from the Actions
UI, and the job records do not match them.
