---
name: dep-sync
description: 'Synchronise TECH_STACK.md and the fixed set of authoritative files when dependencies are installed, updated, or removed. Proposes changes and requires user confirmation before writing anything.'
argument-hint: 'Optional: "added <package>", "removed <package>", or leave blank for a full diff'
---

# DepSync — Dependency Synchronisation

> For canonical background see [ADR-0001](../../../docs/adr/0001-tech-stack-single-source-of-truth.md) and [CONTEXT.md](../../../CONTEXT.md).

## Use This Skill When

- A package was installed, updated, or removed from `package.json`.
- `TECH_STACK.md` may be out of date with the current `package.json`.
- A Claude Code hook has fired warning that `package.json` changed.
- You want to audit whether any authoritative file has drifted back to making direct version claims.

## What DepSync Owns

DepSync is the **only** agent authorised to write version information. Its scope is fixed:

| File                                      | What it updates                                                   |
| ----------------------------------------- | ----------------------------------------------------------------- |
| `TECH_STACK.md`                           | The canonical version table — adds, updates, removes package rows |
| `DEVELOPMENT.md`                          | Checks only — removes any version claim that crept back in        |
| `.github/copilot-instructions.md`         | Checks only — removes any version claim that crept back in        |
| `GEMINI.md`                               | Checks only — removes any version claim that crept back in        |
| `AGENTS.md`                               | Checks only — removes any version claim that crept back in        |
| `.github/skills/grill-with-docs/SKILL.md` | Checks only — removes any version claim that crept back in        |

DepSync never touches source code, test files, lock files, or any file outside this fixed list.

## Workflow

### Step 1 — Read the Ground Truth

Read `package.json` in full (both `dependencies` and `devDependencies`).

### Step 2 — Read the Current Documented State

Read `TECH_STACK.md` in full.

### Step 3 — Diff

Compare every package in `package.json` against `TECH_STACK.md` and categorise each difference:

- **NEW** — package is in `package.json` but not documented in `TECH_STACK.md`
- **REMOVED** — package is documented in `TECH_STACK.md` but no longer in `package.json`
- **VERSION_BUMP** — package exists in both but the version has changed

### Step 4 — Classify New Packages

For each NEW package, determine which section of `TECH_STACK.md` it belongs to. Use the existing section structure as the guide:

- Frontend framework, UI primitives, styling, forms, date utilities, HTTP client
- Backend framework/middleware, authentication, API documentation, logging, email, Google integration, utilities
- Database, Monorepo, Testing, Storybook, Build, Code quality, Design tokens
- If the purpose is unclear, place it in a temporary `## 🔍 Uncategorised — Requires Review` section

### Step 5 — Flag Potentially Temporary Packages

Before proposing any update, check whether a new package might be experimental:

- Was it added without a corresponding change in source files? (grep for its import)
- Is it in the `⚠️ Pending Removal` section already?

Flag these explicitly in the proposal so the developer can decide whether to document it as canonical.

### Step 6 — Check Authoritative Files for Version Drift

Grep each authoritative file (see table above) for version number patterns:
`Next\.js [0-9]`, `React [0-9]`, `Node\.js v?[0-9]`, and similar.

If any file has drifted back to making direct version claims, include removal of those claims in the proposal.

### Step 7 — Present the Proposal

Output the proposed changes in a structured diff format (see Output section below). Do NOT write any file yet.

Ask the user: **"Apply these changes? (yes / no / edit)"**

Only proceed to Step 8 if the user confirms.

### Step 8 — Write

Apply the confirmed changes to `TECH_STACK.md` and any drifted authoritative files. Update the `Last synced` line at the top of `TECH_STACK.md` with today's date.

## Output — Sync Proposal

```markdown
## DepSync Proposal

### Summary

- <N> new packages to document
- <N> packages removed
- <N> version bumps
- <N> version drift findings in authoritative files

---

### New Packages

| Package     | Version     | Proposed Section | Potentially Temporary? |
| ----------- | ----------- | ---------------- | ---------------------- |
| `<package>` | `<version>` | `<section>`      | yes / no — <reason>    |

---

### Removed Packages

| Package     | Was In Section | Action                        |
| ----------- | -------------- | ----------------------------- |
| `<package>` | `<section>`    | Remove row from TECH_STACK.md |

---

### Version Bumps

| Package     | Current in TECH_STACK.md | New in package.json | Section     |
| ----------- | ------------------------ | ------------------- | ----------- |
| `<package>` | `<old>`                  | `<new>`             | `<section>` |

---

### Version Drift in Authoritative Files

| File     | Line     | Current Text | Proposed Fix          |
| -------- | -------- | ------------ | --------------------- |
| `<file>` | `<line>` | `<text>`     | Remove version number |

---

### No Changes

<list of packages already correctly documented, or "All documented packages are current.">

---

**Apply these changes? (yes / no / edit)**
```

## Constraints

- Do NOT write any file before the user confirms.
- Do NOT touch lock files (`yarn.lock`, `package-lock.json`).
- Do NOT modify source code, test files, or any file outside the fixed ownership list.
- Do NOT remove packages from `TECH_STACK.md` unless they are confirmed absent from `package.json`.
- Do NOT categorise a package as canonical if it appears to be unused (no source imports found).
- The `Last synced` date must always reflect when the sync actually happened, not when it was proposed.
