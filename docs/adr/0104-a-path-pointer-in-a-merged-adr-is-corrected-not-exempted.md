# A path pointer in a merged ADR is corrected, not exempted

Issue [#165](https://github.com/mnaimfaizy/myorganizer/issues/165) moves the four flat web
libraries — web-ui, web-vault, web-vault-ui, and web-youtube — under `libs/web/`. Ten merged
ADRs (0014, 0026, 0027, 0039, 0047, 0051, 0052, 0053, 0057, 0093) name those libraries by path,
and `yarn docs:file-refs:check` ([ADR 0093](0093-a-markdown-file-ref-is-asserted-against-the-tree.md))
fails every one of them once the directories move. ADR 0093 says a claim that must stay because
"merged ADRs are not rewritten" takes an exemption, and `tools/config/doc-file-refs-exemptions.json`
repeats that as a reason. Taken literally, every library move would add an exemption per citing
ADR, and each would record something false: that the path is supposed to be absent.

## Status

accepted

## Decision

A backticked path in a merged ADR that points at code which **still exists at a new address** is
a pointer, not part of the decision. When the code moves, the pointer is corrected in place. A
`file:line` citation keeps its line number when the move is a pure rename, because the contents
do not change.

What stays untouchable in a merged ADR is what [ADR 0042](0042-adr-numbers-are-claims-until-merged.md)
protects: its number, and the decision it records. A changed decision is superseded, never
edited. A path that records a **past state** also stays as written — a rejected alternative, a
deleted draft, a directory that must not return. Those are exactly the claims
`doc-file-refs-exemptions.json` is for: a path that is **meant** to be absent.

The test for a given citation: if the code it names were deleted rather than moved, would the
ADR's sentence still be true? If yes, it records history and is exempted. If no, it is a pointer
and is corrected.

A pull request that corrects pointers in merged ADRs lists every ADR it touches and says "path
pointers only", so the edit is visible as what it is.

## Considered Options

- **Keep merged ADRs byte-frozen and exempt every moved path.** Rejected. It grows the
  exemptions file with every library move, states a false reason for each entry, and leaves
  readers following pointers to directories that no longer exist. A stale exemption only fails
  when the named file exists again, which after a move it never will.
- **Exclude `docs/adr/` from the file-refs gate.** Rejected by ADR 0093 already: the defect that
  bought that gate lived in a live addendum on an accepted ADR.

## Consequences

- This narrows ADR 0093's parenthetical "because merged ADRs are not rewritten" to history
  claims. ADR 0093's decision — assert file-refs against the tree, exempt recorded history by
  name — is unchanged.
- Frozen-by-design records are not ADRs and are not covered here: Research Briefs under
  `docs/research/` (ADR 0041), `CHANGELOG.md`, and `tools/config/review-golden-set.json`, whose
  cases are reviewed at the case head where the old paths are correct
  ([ADR 0102](0102-a-golden-replay-reviews-the-case-tree-with-the-pull-requests-harness.md)).
