# Internal notes have homes, and none of them is a catch-all

`docs/internal/` collected planning drafts nobody owned. By August 2026 every one of the four January drafts described work that had already shipped, and several were cited from agent skills — pointing agents at TODO lists for finished features. PR #454 deleted them. Nothing stopped the directory refilling, because nothing had ever said where a note was supposed to go instead.

## Decision

Notes are routed by what they are, and there is no bucket for the leftovers:

- **Planning and history** belong in GitHub issues.
- **Durable decisions** belong in `docs/adr/`.
- **User- and dev-facing feature behaviour** belongs in `docs/features/`.
- **Cited investigation** belongs in `docs/research/` as a **Research Brief** (`CONTEXT.md`): date-prefixed `YYYY-MM-DD-slug.md` and **frozen at that date**.
- **Short-lived working files** belong in `tmp/` (gitignored) and are never committed.

A Research Brief records what was true and cited on its date and is never updated afterward. If a conclusion changes, write a new brief or an ADR — do not edit the old one. The date in the filename is the staleness disclaimer, which is why the prefix is enforced rather than encouraged. This gives the rule a line agents can apply without judgement: **if it must stay current, it is not research** — it is an ADR, a feature doc, or an Agent Guide.

This is a routing rule for _notes_. Subject-area directories (`deployment/`, `testing/`, `ui/`, `vault/`, `authentication/`, `backend/`, `storybook/`, `agents/`, `sandcastle/`, `SECURITY/`) are untouched and out of scope, as ADR 0022 scoped itself to `apps/` and ADR 0023 to `libs/` — one tree each.

`yarn docs:notes:check` asserts that no directory under `docs/` carries a catch-all name and that every brief directly in `docs/research/` is date-prefixed. Husky runs it on every commit; CI runs it on every pull request and push to `main` / `release/*`.

## Considered Options

- **A full taxonomy of `docs/`, with an allowlist of permitted directories** — rejected. The failure mode was a catch-all named "internal", not subject-area docs; `docs/deployment/` never rotted this way. Closing the whole tree turns a cleanup into a governance project and invites arguing whether `storybook/` should fold into `testing/`. It remains available later; this ADR does not block it.
- **Keep `docs/internal/` with a curation rule** — rejected. The directory had a curation rule by implication for eight months and accumulated four dead drafts anyway. A bucket named for its privacy rather than its content gives no signal about when an entry has expired.
- **Treat `docs/research/` as a living reference, kept current** — rejected. It would oblige someone to revisit research files every time an ADR supersedes a decision, which is precisely the maintenance debt that produced `docs/internal/`. `2026-08-15-modern-web-guidance-evaluation.md` was moved unchanged even though ADR 0032 has since retired its "default project-scope install set" vocabulary; under this decision that is correct, not a defect.
- **Write the rule and skip the check** — rejected. `yarn readme:check` is the counter-example: it exists, `AGENTS.md` mandates it, and it runs in neither Husky nor CI, so nothing catches the drift it was written to catch (tracked on #438).
- **Enforce the reserved-name denylist alone** — rejected as close to theatre. Anyone determined to make a catch-all names it `docs/general/`. The date-prefix assertion is what gives the check daily work and keeps `docs/research/` from becoming the next `docs/internal/`.
- **Recurse into `docs/research/` subdirectories for the date prefix** — rejected. A future brief needing an assets folder should not have its attachments forced into a naming scheme meant for briefs.

## Consequences

- The check enforces **shape, not placement**. A stale planning draft committed as `docs/features/some-plan.md` passes clean, and nothing mechanical catches it. Review is the only defence there, and claiming otherwise would be worse than admitting it.
- Adding a brief to `docs/research/` without a date prefix fails the commit and the PR until it is renamed.
- `tmp/` moved out from under the `# compiled output` heading in `.gitignore`, where it sat beside `dist` and `/out-tsc`. It is the directory this rule points everyone at, and filing it as build output reads as safe to wipe.
- `GRILL_WITH_DOCS_INTEGRATION.md` was deleted rather than moved: it was a completion checklist for shipped work, unreferenced, and wrong about the stack it described. The PR record is the canonical history, which is the rule this ADR states.
- ADR 0039 still names deleted `docs/internal/*` paths. That is correct — it frames them as history recoverable from git, which is what the routing rule intends.
