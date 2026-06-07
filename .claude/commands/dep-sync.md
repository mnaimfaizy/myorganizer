# DepSync Command

Synchronise `TECH_STACK.md` and the authoritative files after a dependency change.

## When to Use

- You have just run `yarn add`, `yarn remove`, or upgraded a package.
- A Claude Code hook notified you that `package.json` was modified.
- You want to audit whether `TECH_STACK.md` drifts from `package.json`.

## What Happens

This command runs the DepSync workflow defined in `.github/skills/dep-sync/SKILL.md`.

DepSync will:

1. Read `package.json` and `TECH_STACK.md`
2. Diff them — new packages, removals, version bumps
3. Check the fixed list of authoritative files for version drift
4. Present a **Sync Proposal** and wait for your confirmation
5. Only write after you confirm

## Rules

- Nothing is written until you confirm the proposal.
- DepSync only touches `TECH_STACK.md` and the fixed authoritative files — never source code.
- If a new package looks temporary (no source imports found), it is flagged so you can decide.

## Usage

```
/dep-sync
```

Optional — pass context about what changed to help DepSync focus:

```
/dep-sync added react-query
/dep-sync removed @nestjs/common @nestjs/core
/dep-sync
```

## Reference

Full workflow: `.github/skills/dep-sync/SKILL.md`
Authoritative files list: see the "What DepSync Owns" table in the skill.
ADR: `docs/adr/0001-tech-stack-single-source-of-truth.md`
