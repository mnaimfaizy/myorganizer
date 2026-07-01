---
mode: agent
description: Build and sharpen the project's domain model — pin down domain terminology, resolve fuzzy language, cross-reference with code, and record architectural decisions as ADRs.
---

# Domain Modeling

Read and follow `.github/skills/domain-modeling/SKILL.md` exactly.

## Summary

This skill is the **active** discipline for building and maintaining the project's domain model. It challenges terms, invents edge-case scenarios, and writes the glossary and decisions down the moment they crystallise. It is **not** just reading `CONTEXT.md` — that is a one-line habit. This skill is for when you are _changing_ the model.

## Usage

Invoke this prompt when you want to:

- Pin down domain terminology or resolve conflicting language
- Add or refine entries in `CONTEXT.md`
- Record an architectural decision as an ADR in `docs/adr/`
- Cross-reference a stated assumption with what the code actually does
- Stress-test domain boundaries with concrete edge-case scenarios

## What happens

1. **Read `CONTEXT.md`** — understand terms already defined before starting.
2. **Challenge** — when the user uses a term that conflicts with the glossary, surface the conflict immediately.
3. **Sharpen** — propose precise canonical terms for vague or overloaded language.
4. **Scenario-test** — invent concrete edge cases that force precision about domain boundaries.
5. **Cross-reference** — verify stated assumptions against actual code; surface contradictions.
6. **Update `CONTEXT.md` inline** — write each resolved term immediately, using the format in `.github/skills/domain-modeling/CONTEXT-FORMAT.md`.
7. **Offer ADRs sparingly** — only when a decision is hard to reverse, surprising without context, and the result of a real trade-off. Use `.github/skills/domain-modeling/ADR-FORMAT.md`.
