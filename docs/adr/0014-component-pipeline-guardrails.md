# Component pipeline guardrails: script the shape rules, compile the importers

An audit of `ComponentBuilder` and `ComponentReviewer` found the component pipeline paying frontier-model rates for checks a script settles once, while lacking the one gate that would have caught real breakage.

Three concrete findings:

1. **A ~23.4k-token floor per component.** Both agents opened `TECH_STACK.md` (23.4 KB) and `docs/ui/GUIDELINES.md` (15.4 KB) "in full" as a mandatory first step — 9.7k tokens of foundation reading, twice, before either agent looked at a component. `TECH_STACK.md` is a dependency-version table spanning Prisma, metro, and CI; a component author needs about six rows of it.
2. **ComponentReviewer's §1–§7 checklist restated `docs/ui/GUIDELINES.md` §1–§7.** The agent read the guidelines in full and then re-read them paraphrased inside its own prompt, giving every rule two copies to drift apart.
3. **No compile check anywhere.** `ComponentBuilder` had `tools: [read, edit, search, todo]` and `ComponentReviewer` had `[read, search]`. Neither could execute. A component could be written, reviewed, and accepted having never been typechecked — while the Jest pipeline next door had three enforcement layers.

The importer scan was the worst of both problems: ComponentReviewer was told to search for the component's exported name and _read every file that matched_. `Button` is referenced in 78 files. That step could cost more than the rest of the review combined, and it was approximating — badly — a question the compiler answers exactly.

## Status

accepted — retry cap amended by [ADR 0017](0017-gated-pipeline-cap-and-slice-code-review.md) (3 → 2 reject-cycles)

## Considered Options

**Upgrade the reviewer's model.** Rejected for the same reason as in [ADR 0004](0004-test-runner-pipeline.md): it pays per-run for checks a script settles once, and a smarter model still cannot tell from one file whether a `'use client'` boundary exists three imports up.

**Delete the mechanical checks and rely on ESLint.** Rejected. ESLint owns the rules it has (`no-explicit-any`, unused vars, hook deps) and those stay with it, but the rules that matter most here are repo conventions — barrel export, `cn()` merging, `displayName` on every compound sub-component — and writing nine custom ESLint rules is a heavier lift than one script that also runs standalone in a pre-commit path.

**Split by decidability** (chosen). Each check goes to the layer that can actually decide it.

## Decision

| Layer                         | Owns                                                                                                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check-component-hygiene.mjs` | Shape rules: `forwardRef`/`displayName`, `cn()` merging, barrel export, deep imports, `useCallback` on handler props, inline props types, effect cleanup, generic names, oversized JSX. |
| `tsc --noEmit` + `eslint`     | Type correctness, **importer compatibility**, `any`, unused vars, hook dependency arrays.                                                                                               |
| ComponentReviewer             | Judgment: composition pattern, scope placement, concern mixing, client boundary, Radix-vs-hand-rolled, accessibility beyond the shape rules.                                            |

`tsc` over the owning project **is** the importer check. It resolves every consumer of the changed export and fails with a file and line, which strictly dominates reading 78 files and guessing.

`ComponentReviewer` gains `execute`, for `tsc`, `eslint`, and the hygiene script only. Every judgment item must now cite a line, so a verdict without evidence is visibly incomplete.

### The model tier stays T2

ADR 0004 moved `TestReviewer` to T0 after scripting its checklist, and the same move was evaluated here and **declined**.

The difference is what survives the split. `TestReviewer`'s residual work is genuinely deterministic. `ComponentReviewer`'s residual work — is the compound split right, is this component mixing too many concerns, should this have been Radix, does a primitive secretly know about the domain — is design judgment, and it is exactly the class of question ADR 0004 warned a cheap model answers with an unearned PASS. Requiring a cited line raises the cost of a bogus PASS but does not manufacture the reasoning needed to spot a bad abstraction.

The economics also do not favour it: the gate runs once per component, and its input is already down from ~11.9k to ~4k tokens, so a tier change saves little against an asymmetric risk of waving through design regressions. `tools/config/agent-model-policy.json` keeps `component-reviewer` at T2.

What did change is that the T2 model no longer spends its pass re-deriving `displayName` and barrel exports.

Neither agent reads `TECH_STACK.md` in full. The rules that govern a component live in `docs/ui/GUIDELINES.md`; version lookups are section-scoped.

### Two checks deliberately left out of the script

Both were implemented, run against the codebase, and removed after producing only false positives:

- **`any` detection** — all four hits in the repo carried an `eslint-disable-next-line @typescript-eslint/no-explicit-any` directly above. ESLint already owns the rule and honours its own suppressions; a second implementation that ignores them reports violations the project has consciously accepted.
- **`'use client'` placement** — flagged nine files that are children of components already inside a client boundary. Next.js inherits the boundary through the import graph, so this is not decidable from a single file. It moved to ComponentReviewer as a judgment item.

This mirrors ADR 0004's removal of _"tests would fail if the implementation were broken"_: a check that cannot be decided at the layer holding it is worse than no check, because it produces confident wrong answers.

## Calibration

Rules were tuned against the whole codebase before landing, not designed in the abstract. Final baseline over 140 components: **0 errors, 68 warnings** (41 inline props types, 20 unmemoized handler props, 7 oversized JSX blocks). Errors gate; warnings are advisory and justify `PASS_WITH_WARNINGS`, never `FAIL`.

A zero-error baseline means the script can gate immediately without a cleanup campaign first. The 68 warnings are pre-existing guideline drift, tracked separately.

## Consequences

- New: `tools/scripts/check-component-hygiene.mjs`, `yarn component:hygiene`, and `tools/scripts/lib/source-scan.mjs` — shared lexical helpers now used by both hygiene scripts (the test script was refactored onto it with byte-identical output).
- `ComponentReviewer` gains `execute`; its tool grant must stay `[read, search, execute]` across all four harnesses.
- `docs/ui/GUIDELINES.md` §8 documents the three-layer split; the agents no longer paraphrase §§1–7.
- The 68 warnings are not fixed here. Fixing them is a separate change, as is deciding whether `inline-props-type` and `handler-not-memoized` should ever become errors.
