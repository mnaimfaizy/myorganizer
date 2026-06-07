# TECH_STACK.md as single source of truth for installed versions

`DEVELOPMENT.md` is a human-facing architecture narrative and must not make version claims about installed packages — those drift undetected. We introduced `TECH_STACK.md` at the repo root as the sole file that declares exact package versions and which packages are canonical. All agent instruction files (copilot-instructions.md, GEMINI.md, AGENTS.md, and sub-agent definitions) reference `TECH_STACK.md` rather than declaring versions inline. DepSync is the only agent authorised to write to `TECH_STACK.md`.

## Considered Options

- **Keep DEVELOPMENT.md authoritative** — rejected because an 900+ line narrative document is not kept in sync by CI or agents; version claims inside prose paragraphs go stale silently.
- **CONTEXT.md umbrella** — rejected because CONTEXT.md is a domain glossary; mixing versioning concerns into it would violate its single responsibility.

## Consequences

Anything that makes a version claim must either live in `TECH_STACK.md` or reference it. Any new agent instruction file must read `TECH_STACK.md` first before assuming what technology version is in use.
