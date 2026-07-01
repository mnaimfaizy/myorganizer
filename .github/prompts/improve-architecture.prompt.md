---
mode: agent
description: Scan the codebase for architectural deepening opportunities, present them as a visual HTML report, then grill through whichever candidate you pick.
---

# Improve Codebase Architecture

Read and follow `.github/skills/improve-codebase-architecture/SKILL.md` exactly.

## Summary

This skill surfaces **deepening opportunities** — refactors that turn shallow modules into deep ones. It produces a self-contained HTML report written to the OS temp directory, then opens a grilling loop on whichever candidate you choose.

## Usage

Invoke this prompt when you want to:

- Find modules whose interface is nearly as complex as their implementation (shallow modules)
- Identify where logic leaks across seams in the Nx library boundaries
- Discover which parts of the codebase are hard to test through their current interface
- Propose concrete refactors with before/after diagrams before committing to any one

## What happens

1. **Explore** — reads `CONTEXT.md` and ADRs, then delegates a codebase walk to `CodeExplorer`
2. **Report** — writes `architecture-review-<timestamp>.html` to the OS temp dir and opens it
3. **Grill** — once you pick a candidate, runs the `grill-with-docs` skill to design the deepening together

No code is written until you explicitly ask for implementation after the grilling loop.
