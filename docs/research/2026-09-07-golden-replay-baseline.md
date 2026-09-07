# Golden replay baseline (2026-09-07)

Research date: **2026-09-07**. Frozen at that date: every number below comes from a run of `.github/workflows/review-golden-replay.yml` on branch `feat/ci-review-workflow` (PR #682) and will not be updated. Decision context: [ADR 0071](../adr/0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md), whose Consequences say the ADR that narrows CODEOWNERS and makes the agent verdict a required check "can be written once the golden-set replay has a record". This is that record's first entry.

## Question

Given the code reviewer as it stands (the `/code-review` skill, `claude-sonnet-5`, the reach-through brief added on 2026-09-07), how often does it raise the finding that would have caught an incident this repository already paid for, when replayed against the pull request that introduced the incident?

## Method

The golden set in `tools/config/review-golden-set.json` names seven commit ranges, each the pull request that introduced a documented defect, attributed with `git log -S` or `git blame` and the fix pull request's own account, and the finding a reviewer should have raised, as patterns over axis, source, rule, and file. `tools/scripts/review/score-golden-case.mjs` scores the validated report of one reviewer run against one case; recall is matched over expected. Standards are today's. Each replay is one reviewer run per case, in parallel, on the current skill.

Five replays are reported: three on the original three-case set (two before the reach-through brief, one after, re-run once), then the first seven-case run. A sixth attempt is omitted: all seven reviewers failed within a minute because the subscription's session limit was hit by eight parallel sessions, and it produced no measurement.

## Results

| Case                                                                                         | Introduced by | 3-case run 1 | 3-case run 2 | after reach-through, A | after reach-through, B | 7-case run |
| -------------------------------------------------------------------------------------------- | ------------- | ------------ | ------------ | ---------------------- | ---------------------- | ---------- |
| Groceries blob type without its fan-outs (ADR 0053, #512)                                    | PR #101       | caught       | caught       | caught                 | caught                 | caught     |
| Export envelope drops Tasks (ADR 0053, #537)                                                 | PR #77        | missed       | caught       | caught                 | caught                 | caught     |
| Warning role unstyles groceries, as first written (ADR 0065)                                 | PR #631       | missed       | missed       | missed                 | missed                 | withdrawn  |
| Groceries UI written against absent roles (ADR 0065, #632)                                   | PR #108       | —            | —            | —                      | —                      | missed     |
| Sync Bookmarks without a restore that clears them, or a meta push (#617, #589; two expected) | PR #573       | —            | —            | —                      | —                      | 0 of 2     |
| Release bump without `openapi:sync` (#408)                                                   | PR #379       | —            | —            | —                      | —                      | missed     |
| Sign-up password wrapper inside FormControl (#525)                                           | PR #215       | —            | —            | —                      | —                      | missed     |
| Bare `window.confirm` on a whole-vault replace (#657)                                        | PR #40        | —            | —            | —                      | —                      | missed     |

Seven-case baseline: **2 of 7 cases, 2 of 8 expected findings**. Cost of that run: about $14 across seven reviewer sessions of 40 to 60 turns each.

### What the reach-through brief changed

The export-envelope case went from one catch in two runs to four in four. The brief tells the Standards sub-agent that a member added to an enumerated set means every hand-enumerated consumer must be touched, and to prove it with `git grep` against the tree at head. On the PR #631 range the same brief also produced a catch the golden set had not asked for: the new `warning` role had been propagated to both web Tailwind configs and not to the mobile theme's hand-enumerated colour map.

### The withdrawn case

The PR #631 case was an attribution error, found by the replay itself: that pull request added the `warning` role and removed nothing, so there was no consumer to reach through to. The groceries pages shipped unstyled because PR #108 had written them against Material Design 3 role names, `surface-container-low` and its siblings, that no token or Tailwind config defined. The case now names PR #108, and `git grep` confirms the range goes from zero to six groceries files carrying those names.

### What the misses look like

None of the five misses is a scoring artefact. On every missed range the reviewer produced findings, several of them blocking and correct by the repo's standards, and none of them the incident:

- On PR #108 it raised ten findings, including three blocking ones about forms built without React Hook Form and a Markdown file under `libs/`, and said nothing about the class names. It did not run the stylesheet, and no gate existed at that head to run.
- On PR #573 it raised a blocking finding about a missing `onConflict` on the one remaining Vault Meta write, adjacent to the defect, and did not follow the reasoning to "a local passphrase change now never reaches the server".
- On PR #379 it read the version bump as a release-tag concern and did not ask what else embeds the version.
- On PR #215 and PR #40 it raised architecture and placement findings and did not read the one component pattern the incident turned on.

The pattern across all five: the reviewer applies the documented rule to the hunk in front of it and does not ask what the hunk does to the running system. The two cases it catches are the two whose rule, since ADR 0053, names the systemic consequence explicitly.

## Limits

- Five replays of a stochastic reviewer is a small sample; the export-envelope case shows a single run can go either way.
- Every case is attributed by one person and the fix pull request's own narrative. A case's `files` and `rule` patterns encode a judgement about where a fair reviewer would locate the finding.
- Standards are today's. A case is not evidence that the rule existed when the defect merged.
- The replay is eight parallel reviewer sessions per push of a review-tooling branch on one subscription. One run of eight was lost entirely to the session limit; `CODE_REVIEW_ENABLED=false` stops the replay, and `max-parallel` on the matrix is the next lever if it recurs.

## What this settles

The verdict is not ready to be a required check. Two catches in seven is a reviewer that finds real problems and misses the ones the repository has already paid for, and ADR 0071 makes the second number the one that matters. The next work is on the reviewer, measured here: the brief's reach-through checks moved one case from a coin toss to certain, and the misses point at a second class of instruction, "what does this hunk do to the running system", that the brief does not yet carry.

## Reproduce

```bash
yarn review:golden:check
```

Then open a pull request touching any path in `.github/workflows/review-golden-replay.yml`'s filter, or re-run the workflow from the Actions tab.
