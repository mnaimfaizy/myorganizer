# A concurrency group agrees with the job it cannot see

It happened three times in one morning. `ai:create-pr` adds a label a second after opening a pull
request, and those `labeled` runs of `.github/workflows/code-review.yml` cancelled the review in
flight on [#687](https://github.com/mnaimfaizy/myorganizer/issues/687) and
[#690](https://github.com/mnaimfaizy/myorganizer/issues/690). The fix sent them to a group of their
own, and a bot comment on [#693](https://github.com/mnaimfaizy/myorganizer/issues/693) did the same
thing an hour later through the `issue_comment` trigger, which had been left in the shared group —
invisible to anyone listing runs for the pull request's branch, because `issue_comment` runs are
attributed to the default branch. Then the shared inert group cancelled itself on
[#694](https://github.com/mnaimfaizy/myorganizer/issues/694).

## Status

accepted

## Context

`concurrency` is evaluated when a workflow run is created, before any job's `if:` is read. A run
whose every job refuses to do anything is, from concurrency's perspective, still a run: it joins
whatever group its expression names, and with `cancel-in-progress: true` it cancels anything already
running in that group — including a real review mid-flight.

The `context` job's `if:` already encodes which triggers are real: a comment only starts a run when
it is on a pull request, is the `/code-review` command, and comes from an author association of
`OWNER`, `MEMBER`, or `COLLABORATOR`; a label only starts one when it is `agent-review`. Everything
else reaches the runner, does nothing, and — without a matching concurrency expression — still
cancels whatever was running for that pull request.

The two expressions are written in the same language about the same event payload, and they cannot
share a definition: one is evaluated by GitHub before the workflow's jobs exist, the other inside a
job. Keeping them in sync by inspection is how the same class of bug reached the group three times
in one morning.

## Decision

**Every trigger the `context` job's `if:` refuses is also steered into a concurrency group of its
own, keyed off the run id, so it cannot collide with — and cannot cancel — the group carrying the
review that trigger is not allowed to start.** The `code-review.yml` concurrency `group:` expression
restates the same two conditions the job's `if:` refuses on (an `issue_comment` that is not an
authorized `/code-review` command; a `labeled` event whose label is not `agent-review`) and appends
`-inert-${{ github.run_id }}` when either holds, so an inert run never shares a group with a real
one and never shares a group with another inert run either.

Authorization for `/code-review` is therefore decided in the group expression and the job `if:`, not
in a step. A check inside a running job happens after the run has already joined its group and, with
`cancel-in-progress`, already cancelled whatever was in flight — by the time an unauthorized
commenter's run could be told to stop, the damage the concurrency group does is already done. So the
group expression has to be the enforcement point, not a shortcut in front of it.

**`yarn review:concurrency:check` asserts the two agree**, structurally rather than by evaluating
GitHub's expression language: it compares the literals that decide the outcome — the trigger label,
the command, and the commenter associations allowed to use it — between the `group:` expression and
the `context` job's `if:`. Renaming or widening either in only one place fails the check until the
other follows. `--print` shows both expressions and the literals tying them together.

## Consequences

A permission tweak to who may run `/code-review`, or to which label triggers it, now has to move in
two places in the same file, and the check is what turns forgetting the second place into a failing
commit instead of a fourth incident. `yarn review:concurrency:test` covers the checker.

This does not remove the underlying GitHub behaviour — a skipped run still joins a group — it only
guarantees that every group an inert run can join is a group inert runs share with each other and
never with a real review.
