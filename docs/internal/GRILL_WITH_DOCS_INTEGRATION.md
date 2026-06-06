# Grill-with-Docs Skill Integration Summary

## ✅ Integration Complete

The `grill-with-docs` skill from [mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/grill-with-docs) has been successfully integrated into MyOrganizer and made available across all AI IDEs.

## 📁 Files Created

### Main Skill Directory: `.github/skills/grill-with-docs/`

1. **SKILL.md** — Core skill definition
   - Grilling interview approach (ask one question at a time)
   - Domain awareness specific to MyOrganizer
   - Guidance on challenging terminology, discussing scenarios, and updating documentation
   - Instructions for creating/updating CONTEXT.md and ADRs

2. **CONTEXT-FORMAT.md** — Template for domain glossaries
   - How to write `CONTEXT.md` (domain language single source of truth)
   - Rules for being opinionated, keeping definitions tight, including only domain-specific terms
   - Single vs multi-context repo patterns

3. **ADR-FORMAT.md** — Template for architecture decisions
   - How to write ADRs in `docs/adr/` (numbered sequentially)
   - When to offer an ADR (hard to reverse, surprising, result of trade-off)
   - What qualifies as an ADR (architectural shape, integration patterns, technology choices, boundaries, deliberate deviations)

4. **README.md** — Quick reference guide
   - Overview of what the skill does and when to use it
   - MyOrganizer-specific context (domain terms, tech stack)
   - Pointer to full skill files

## 🔧 IDE Configuration Updates

### 1. GitHub Copilot (`.github/copilot-instructions.md`)

- ✅ Added "Design & Planning" section
- ✅ Documented when to use grill-with-docs
- ✅ Explained key artifacts (CONTEXT.md, ADRs)
- ✅ Linked to skill templates

### 2. Claude (CLAUDE.md)

- ✅ Added "Design & Planning Workflows" section
- ✅ Explained skill purpose, use cases, and workflow
- ✅ Documented key documents to maintain
- ✅ Referenced format templates

### 3. Gemini (GEMINI.md)

- ✅ Added "Design & Planning Workflows" section
- ✅ Documented skill purpose, use cases, and workflow
- ✅ Explained key documents to maintain
- ✅ Referenced format templates

### 4. Cursor (`.cursor/rules/grill-with-docs.mdc`)

- ✅ Created new rule file with MDC frontmatter
- ✅ When to use instructions with concrete examples
- ✅ Core approach (relentless interviewing, code exploration, terminology sharpening)
- ✅ MyOrganizer-specific context and tech stack

### 5. Project Agents Guide (AGENTS.md)

- ✅ Added bullet point for design/planning requests
- ✅ Links to `.github/skills/grill-with-docs/SKILL.md`
- ✅ Explains CONTEXT.md and ADR documentation

## 🎯 How to Use

### For Claude Users

```
"I want to design a new feature for [X].
Can you grill this plan using the grill-with-docs skill?"
```

### For GitHub Copilot Users

```
"Let's use the grill-with-docs skill to stress-test
this architectural decision against our domain model."
```

### For Cursor Users

The grill-with-docs rule is enabled in `.cursor/rules/` and will be applied to relevant conversations.

### For Gemini Users

Reference the skill when you want to validate a design against existing domain language and architecture.

## 📚 Key Concepts

### CONTEXT.md (Domain Glossary)

Single source of truth for project-specific domain language:

```md
**Vault**: End-to-end encrypted storage for sensitive data on client;
server stores ciphertext only.
_Avoid_: Safe, encrypted storage, secure container
```

- One-sentence definitions only
- Include "Avoid" list (synonyms to reject)
- No implementation details
- Created lazily, updated inline during planning sessions

### ADRs (Architecture Decision Records)

Documents of hard-to-reverse decisions made during planning:

```md
# We use vault encryption for sensitive data

End-to-end encryption ensures plaintext never leaves the browser...
Considered: Server-side encryption, plaintext with TLS. Selected vault...
```

- Live in `docs/adr/` numbered sequentially
- Only created when all three criteria are met:
  1. Hard to reverse (meaningful cost to change)
  2. Surprising without context (future reader wonders "why?")
  3. Result of real trade-off (alternatives were considered)
- Created lazily, only when actually needed

## 🚀 MyOrganizer-Specific Context Pre-loaded

The skill is pre-configured with MyOrganizer's:

**Domain Terms:**

- Vault (E2EE storage, ciphertext-only on server)
- Todo (task/item, vault-backed)
- Subscription (recurring, vault-backed)
- User (authenticated account holder)
- Organization (group for resources)
- Ciphertext (encrypted blob format)

**Technology Stack:**

- Frontend: Next.js 14, React 18, TypeScript, Tailwind CSS
- Backend: Express.js, Prisma ORM, TSOA
- Database: PostgreSQL
- Monorepo: Nx with path aliases
- Testing: Jest, Playwright

**Key Constraints:**

- Vault = ciphertext-only on server (no plaintext indexing)
- Todos are vault-backed (not a plaintext Prisma model)

## ✨ What's Next?

The skill is now ready to use for:

- 🎨 Design review sessions ("Grill this feature plan")
- 📖 Domain language refinement ("Let's define this term")
- 🏗️ Architecture discussions ("Should we use X or Y?")
- 📝 Documentation ("What should this ADR say?")
- 🤔 Terminology sharpening ("Is 'user' the right word here?")

Start by invoking the skill with a feature plan or design question in any of the supported IDEs!
