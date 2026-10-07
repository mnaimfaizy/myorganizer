# A review report's facts about its own run are read from the transcript

## Status

accepted

## Context

CI review run [37576528356](https://github.com/mnaimfaizy/myorganizer/actions/runs/37576528356)
(pull request #1030, 2026-10-07) published "No findings" on the Standards axis and listed four
`standardsSources`. Its transcript shows the Standards sub-agent made two tool calls and opened none
of the four. It had run `ls` on two of them. Its reply said in prose that it had not opened
`CODING_STANDARDS.md`, and listed the files in its JSON anyway. The main agent copied the list into
the report, because the skill told it to use the sub-agent's list and not recompute it (issue
#1031).

The same transcript shows the main agent doing more than assembling:

- It dispatched 22 of the Standards catalogue's 37 rule ids. The 15 it dropped include every
  `obligation-*` id, `standard-secret-committed`, and `standard-vault-plaintext-leaves-the-client`.
- It added "Only report real defects; empty findings is fine" to both dispatches. Neither sentence
  is in the skill.
- Its shortened contract dropped the `confidence` enum. A sub-agent returned `0.6`, and the main
  agent rewrote it to `"medium"`.
- It re-read the one finding's file and decided the severity should stand.

The report also carried `durationMs: 20000` for a session the harness timed at 39,859 ms, and an
`executed` list holding prose in place of commands. `tools/scripts/review/schema.mjs` checks the
shape of all of these fields and the truth of none.

[ADR 0071](0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md)
already settled this for the verdict: it is computed, and no model writes it. Everything else the
report says about its own run was still written by the model being described.

## Decision

**In CI, what a review report says about its own run is read from the reviewer transcript after the
reviewer has exited. The reviewer does not write it.**

1. **Four envelope fields are pinned.** A step reads the transcript and writes a facts file. The
   validator takes that file the way it takes `--tier`, and overwrites `standardsSources`,
   `executed`, `durationMs`, and `model` from it. The CLI version is recorded beside the model. This
   is report schema version 5.
2. **A Standards Source is listed when the Standards sub-agent opened it.** Opened means a tool call
   that returns a file's content by path: the Read tool at any range, `cat`, or
   `git show <sha>:<path>`. A search is not an open. A file qualifies when it is
   `CODING_STANDARDS.md`, a path that index links to, or an `AGENTS.md` at any depth.
   `docs/review/REVIEW_CHECKLIST.md` is excluded by name. Root `AGENTS.md` and `CLAUDE.md` are loaded
   by the harness without being opened. The published comment says so in a fixed note and does not
   list them.
3. **An interactive run has no transcript to read.** Its fields stay self-reported, and the report
   marks them as such.
4. **Two transcript facts fail `Agent Review Ran`.** No sub-agent read an axis's brief. Or a finding
   in the report is not equal, field for field, to a finding a sub-agent returned. Both are facts
   about the pipeline
   ([ADR 0073](0073-a-required-check-is-a-fact-about-the-pipeline-not-a-judgment-about-the-diff.md)):
   the axis did not run as built, or the main agent authored a finding. Dropping a Standards finding
   under the one-axis-per-defect rule is not a change.
5. **Three transcript facts tighten the effective tier and are published.** The Standards sub-agent
   read its brief but never opened `CODING_STANDARDS.md`. A dispatch carried text beyond the skill's
   fixed template. Or the transcript's shape could not be read. Together they cost at most one tier
   step, on top of the separate step a missing spec already costs.
6. **"Cannot tell" is its own answer.** The step asserts the transcript's shape before reading facts
   from it. A transcript that fails is recorded as unknown, never as an empty list and never as the
   model's own claim. The step raises an error annotation naming the CLI version. A sub-agent reply
   the step cannot parse is unknown in the same way.
7. **The golden replay follows production.** Whatever fails `Agent Review Ran` in production voids a
   replay, with two new reasons, `brief-not-read` and `finding-not-returned`
   ([ADR 0101](0101-a-replay-whose-answer-sheet-fails-its-check-measured-nothing.md)). Whatever only
   tightens the tier is scored, and the fact is recorded on the result line.

## Considered Options

**Check the reviewer's list against the transcript and fail on a mismatch.** This was the issue's
own proposal, after
[ADR 0078](0078-a-citation-that-does-not-match-its-source-is-a-fact-about-the-pipeline.md). It was
rejected because the model stays the author of the fact. A reviewer that reads nothing and lists
nothing passes, so the less honest list is the one that fails. And the check would fail on pull
requests whose diff is fine, at whatever rate the model mislists.

**Fail `Agent Review Ran` when `CODING_STANDARDS.md` is not opened.** Rejected. Thoroughness is not a
gate (ADR 0078). The run above skipped the index and still found a real gap on the Spec axis. A red
check there would give the author nothing to do but re-run. A tightened tier and a published line
tell a human the review was thin, which is what happened.

**A threshold on how many sources were opened.** Rejected. Any number would be invented, and a diff
touching one area needs only the index and one Agent Guide.

**Pin the Claude Code CLI version so the transcript's shape cannot move.** Left out. The shape check
in item 6 turns drift into a visible event with the version attached. A pin trades that for a
version nobody remembers to raise.

## Consequences

A required-eligible check now depends on the transcript format of a CLI this repository does not
version. Item 6 is what keeps a format change from reading as "no sub-agent read its brief" on every
pull request. The contract tests need fixtures cut from real transcripts. The four fixtures the
classifier had before this decision hold no sub-agent events.

The first review of every open pull request after the schema bump shows no comparable previous run,
and finding ids are not carried across it, because ids only mean the same thing within a schema
version.

A golden replay that misses because the reviewer skipped the index is a miss. Voiding it would hide
the regression this decision exists to show. The result line records the skip, so the results file
can say whether a miss came from a thin review without anyone downloading a transcript.

The note in item 2 is a claim about the harness, so it has to be confirmed from a real run: a
sub-agent must be able to quote root `AGENTS.md` without opening it. If it cannot, the note is false
and the brief has to tell the sub-agent to open that file.

A finding's own executed evidence, its command and exit code, is still self-reported and can still
earn Blocking. Checking it against the transcript needs matching rules of its own and is issue
#1039.
