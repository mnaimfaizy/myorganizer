# The wired-gate qualifier bought nothing measurable

Frozen 2026-09-09. The numbers this reads from are in
[`docs/review/golden-replay-results.md`](../review/golden-replay-results.md),
which stays current; this brief does not.

## What was under test

Commits `fa39390` and `07327af` narrowed one line of the finding contract in
`.agents/skills/code-review/SKILL.md`. Suppression had read "anything a
`*:check` gate would already fail is NOT a finding"; it now requires the gate
to be **wired** — invoked at `<head>` by a `.husky` hook, a workflow, or the
`yarn gates:run` manifest — and states that a defect an unwired checker would
have caught is a finding.

The hypothesis was specific. Golden case
`release-bump-leaves-generated-client-stale` (issue #408) is exactly the shape
the old wording mishandles: at the case's head `8175cb6`, `openapi:check`
existed in `package.json` and was invoked by no hook and no workflow. Read
literally, the old rule told the reviewer to suppress the one finding that
mattered. If that was why the case scored 1 of 4, the qualifier should move it.

## What happened

**It did not move.** `release-bump` missed in both runs — `34344266006` at
`fa39390` and `34345667427` at `07327af` — with a valid report each time. It
now stands at one catch in six attempts.

Run `34344266006` is not evidence either way and should not be read as such.
It was cancelled mid-flight when `07327af` was pushed, and it was confounded
before that: at `fa39390`, `AGENTS.md:61` still carried the old wording, and
`AGENTS.md` is one of the standards sources the reviewer loads. The reviewer
held the new rule in the brief and the old rule in the standards at once. The
CI reviewer raised precisely that as a blocking finding on the pull request
that introduced it, which is how the confound was found.

Run `34345667427` at `07327af` is the clean measurement: all seven cases
produced valid reports, no voids, **2 of 7 cases and 2 of 8 findings**.

## The variance is now the strongest signal in the record

Three consecutive full-set runs have scored 2 of 7 or 2 of 8. Each named a
different pair.

- `34171728640` — `release-bump` caught, `export-envelope` missed.
- `34344266006` — `export-envelope` caught, `release-bump` missed.
- `34345667427` — `import-confirm` caught, `export-envelope` missed.

`export-envelope-drops-tasks` was caught at 11:23 and missed at 11:35 the same
morning, on ranges nothing in either commit touches. And
`import-confirm-is-bare-window-confirm` was caught for the first time in this
run, having missed every previous attempt — under a brief change about gate
suppression, which has no mechanism by which it could reach that case. That
catch is variance, not effect, and it should not be credited to the qualifier.

The practical reading: apart from the guard, per-case outcomes look close to
independent draws at a low hit rate, not stable per-case capability. A single
run moves a case in either direction and settles nothing. The `guard` /
`frontier` split is meaningful at the guard end —
`groceries-blob-type-without-fanouts` is now caught in eight of eight — and
close to noise across the frontier.

## What this does and does not settle

**Settles:** the qualifier has no measured effect on recall. It was still
correct to land, on grounds independent of recall — the old wording
contradicted the Meta-Gate (`tools/scripts/check-gate-coverage.mjs`, ADR 0043),
whose premise is that a checker no hook and no workflow runs is not a gate.
Two parts of the same system disagreed about what "a gate covers this" means.
That is worth fixing whether or not it changes a number.

**Does not settle:** why `release-bump` misses. The suppression hypothesis is
now the weaker explanation, and a better one is available from reading the
skill: the file _permits_ running gates — "may run in the checkout", "prefer
executed evidence" — but nowhere tells the reviewer **which** gate to run for a
given diff. For this case `yarn openapi:check` would have failed on the spot
and produced `executed` evidence at blocking grade. The reviewer had
permission and no instruction. "You may run things" and "run these things" are
different sentences, and only the first is in the brief.

## What follows

An instruction added at the site of a miss has now failed to produce a catch
twice: the consequence checks on 2026-09-07, and this qualifier. Both were
prose in a brief that the reviewer applies at its discretion. The next
intervention worth measuring should not be a third instruction. It should
change whether the check _fires_ rather than what it _says_ — a per-diff
obligation the reviewer must answer, selected outside the model and attached
to specific hunks, so that noticing is no longer the reviewer's job.

The measurement protocol should also change. Both replays in this record were
`pull_request`-triggered, and the workflow's concurrency group
(`golden-replay-<pr>`, `cancel-in-progress: true`) means any push to the branch
cancels the run in flight. `[skip replay]` cannot prevent that: it is evaluated
in a step inside the `cases` job, long after the run is created and has joined
the group. Runs intended as measurements should be dispatched on a settled
head, not carried by a pull request that is still being edited.
