# Local content moves to where it is always true, not into a fork

`diagnosing-bugs` and `domain-modeling` join the Upstream-Owned Skills of [ADR 0030](0030-upstream-owned-skills-are-project-scope.md). `code-review` cannot, for a reason that is not about its content.

Each fork's local additions were re-read against one rule: **content true regardless of which skill is running belongs in `AGENTS.md`; content saying which skill runs next belongs in `ask-matt`; a fork is justified only by content meaningless outside that one skill's procedure.** Almost nothing survived it.

`diagnosing-bugs` carried three additions. Its post-mortem handoff to `/improve-codebase-architecture` was already at `ask-matt/SKILL.md:42`. Its absolutised script path was cosmetic. Only the redaction rule was real, and it is now in `AGENTS.md` beside the existing secrets rule — because "never paste vault plaintext or session cookies into chat" is true when writing tests or reviewing a PR, and a safety rule scoped to one workflow is a safety rule with holes.

`domain-modeling` carried one appended section. Two bullets (read `CONTEXT.md` first, ADRs number sequentially from `0001`) are needed by `grill-with-docs` too, so they were never skill-local; two restate vault rules already in `AGENTS.md`.

`CONTEXT-FORMAT.md` and `ADR-FORMAT.md` existed twice, byte-identical, in `domain-modeling/` and `grill-with-docs/`. Upstream-owned `domain-modeling` now owns them and `grill-with-docs` links across, which converts a silent duplication into a guarded link.

## Status

accepted

## Considered Options

- **A thin repo-native wrapper skill per external** — rejected, and this rejection generalises. A project-scope install takes the directory name, so a wrapper needs a different name _and_ a different description. The model routes on description, so two skills both saying "use when the user reports something broken" is a coin flip on every invocation, deciding silently whether the vault-redaction rules load. Making the wrapper win would mean editing the upstream skill's description to de-trigger it — a hand-edit ADR 0030 forbids, reverted by the next `npx skills update -p`.
- **Keep repo-specific content next to the skill that uses it** — rejected. Locality is usually right, but it produced the state being undone here: forks holding content that was either already elsewhere or belonged in always-on policy, two of them silently drifting behind upstream while nobody compared them.
- **Move `code-review`'s standards list into `AGENTS.md`** — rejected. It is nine lines consulted by one skill, and `AGENTS.md` is paid for on every request. It also would not give a human the file they would look for.
- **Adopt `CONTEXT-FORMAT.md` / `ADR-FORMAT.md` as repo docs outside both skills** — rejected. Read them: they are generic format advice with nothing MyOrganizer-specific in them. Adopting them would claim authorship of upstream's text and take on its maintenance.
- **Hand-copy upstream `code-review` and fix its YAML ourselves** — rejected. That is hand-vendoring, which `EXTERNAL_SKILLS.md` forbids and the ADR 0030 check correctly fails for a skill absent from `skills-lock.json`. It would diverge with no lockfile hash to detect it.

## Consequences

- `CODING_STANDARDS.md` now exists at the repo root as an **index** of the eight documents that hold standards, and `code-review` reads it instead of carrying the list. The filename is not arbitrary: upstream's own step 3 names `CODING_STANDARDS.md` as a thing to look for, so this uses upstream's extension point rather than working around it — the same shape as `docs/agents/issue-tracker.md`. Keep it an index; a rule restated there becomes a second source of truth.
- The repo had no such index before. `AGENTS.md` referenced none of the eight paths, so any agent not running `code-review` had nothing to consult. The fork was hiding a real gap inside one skill.
- **`code-review` stays repo-native, and the reason is upstream's, not ours.** Six of the 35 skills in `mattpocock/skills` — `code-review`, `setup-matt-pocock-skills`, `to-spec`, `wait-what`, `writing-fragments`, `writing-shape` — have an unquoted `: ` inside their `description:` frontmatter value. That is invalid YAML, and the CLI silently drops them: it reports "Found 29 skills" against 35 in the tree. Our fork is installable only because its rewritten description happened to use an em-dash where upstream used a colon. Revisit when upstream quotes those descriptions; nothing about the content argues for a fork.
- The link guard now also scans `.github/prompts/`, and matches repo-rooted `.agents/skills/<skill>/<file>.md` paths as well as relative `../<skill>/<file>` hops. `.github/prompts/domain-modeling.prompt.md` links an Upstream-Owned companion file by absolute path and was previously unguarded.
- `.prettierignore` and `.gitattributes` each gain the two new directories, as ADR 0030 requires and the check asserts.
