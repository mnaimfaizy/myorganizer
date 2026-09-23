# A fix names what introduced it, in its commits

## Status

accepted

## Context

[ADR 0077](0077-an-escaped-defect-is-one-the-reviewer-saw-and-passed.md)
makes the escaped-defect rate the trust measure for the automated reviewer:
of the Pull Requests the reviewer passed, what fraction a later fix names as
root cause. Its first measurement read 57 fixes and found none that named a
root cause, so the rate reported `not measurable` and could not do otherwise
(issue #736). ADR 0077's consequences already named the missing line —
`Introduced in #415` — but nothing asked anyone to write it, and a sentence is
not an assertion ([ADR 0085](0085-an-artifact-states-no-claim-it-does-not-assert.md)).

The golden set already does this archaeology by hand, after the fact, with
`git log -S` and `git blame`. The measurement needs the same fact recorded at
the time, by the person or agent who just traced the defect, when it is
cheapest to write.

Four things had to be decided: where the line lives, what it looks like,
whether anything enforces it, and whether the 57 are backfilled.

## Decision

1. **The line lives in a commit on the fix branch.** The measurement reads
   three sources — the closing issue, the Pull Request body, the commits —
   but only the commits are read on every run. The issue and the body need a
   token, and the first measurement ran without one. Commits are also what
   [ADR 0076](0076-an-agent-branch-carries-its-issue-in-its-first-commit.md)
   already uses to carry a machine-readable fact on a branch. The issue and
   the body stay readable sources; they are not where the convention asks
   for it. A squash merge folds the branch's messages into its own body, so
   the measurement reads a squashed fix's whole message, not its title —
   otherwise a squashed fix would pass the gate and still measure nothing.

2. **The line is `Introduced in #<pull request>`.** It is the form ADR 0077
   names, and the parser's existing `introduced-in` marker already reads it,
   so the convention needs no new vocabulary. A commit SHA in place of the
   number is read too, and resolved to the Pull Request that landed it. Every
   other phrasing in `ROOT_CAUSE_MARKERS` still counts; this is the one that
   is documented.

3. **A fix that looked and found nothing writes
   `Introduced in unknown: <why>`.** The line starts with the same lead, so
   there is one convention to remember. It must start a line, so the words
   inside a sentence are not read as a declaration, and the reason after the
   colon is required, so a bare `unknown` cannot stand in for the archaeology. It is not attribution: it
   resolves to no Pull Request and never enters the numerator. It is counted
   in its own fix class, `origin-unknown`, so that "nobody could name it" is a
   recorded outcome and stays distinct from `unattributed`, which now means
   only that nobody wrote anything. A reference named in any source outranks
   a declaration in another.

4. **It is a gate.** `yarn fix:attribution:check` runs in CI on every Pull
   Request and fails a fix — a `fix/` branch, or a `fix` Conventional Commit
   title on a branch whose prefix names no type — whose commits in
   `base..head` carry neither line. It asks the measurement's own
   `pullRequestType` and `attributeFix` rather than restating them, for the
   reason ADR 0076 item 4 gives: a copy agrees on the examples in its test and
   drifts on everything else, and a gate that accepted a line the measurement
   cannot read would pass while the rate stayed empty. It does not check that
   the reference resolves or is earlier than the fix; the measurement already
   classifies those as `unresolved` and `not-earlier`, where they are counted.

   This is not the measurement becoming a gate, which ADR 0077 item 7
   rejects. The measurement reads months of history and the network; this
   gate reads one Pull Request's commits and asserts one fact about them.

5. **No backfill.** Merged commits cannot be amended. The fixes that could
   matter are few: every root cause merged before the reviewer went live on
   2026-09-06 is `unreviewed` whatever the fix says, so only fixes naming a
   Pull Request merged after that date could ever reach the numerator. For
   those, the closing issue is still an editable source that the measurement
   reads, so anyone who wants one attributed can add the line there. The
   measurement's population starts to carry the line from the day this
   lands.

## Consequences

- The rate can leave `not measurable` once Pull Requests the reviewer passed
  are named by later fixes. The denominator still needs time; this decision
  only fills the numerator's side of the pipe.
- Every fix Pull Request costs one line, and the line demands the
  archaeology the golden set already performs by hand. When the archaeology
  finds nothing, `Introduced in unknown` is the honest answer and passes.
- The first measurement's 57 `unattributed` fixes stay `unattributed`. The
  running record says so rather than restating them.
- `origin-unknown` is a new member of `FIX_CLASSES`, pinned like the others.

## Alternatives considered

- **The Pull Request body.** Rejected as the home: it is unreadable on a
  git-only measurement, and a gate on it would need a token. It stays a
  source the measurement reads.
- **A git trailer, `Introduced-in: #415`.** Rejected: the parser does not
  read the hyphenated form, and adding it would add vocabulary to a list
  ADR 0077 item 6 keeps short on purpose.
- **Convention only.** Rejected: the convention was already written in
  ADR 0077, and the first measurement is what it produced.
- **Fail on a reference that does not resolve.** Rejected: it would make an
  author argue with the archaeology in CI, and the measurement already counts
  a bad reference where everyone can see it.
