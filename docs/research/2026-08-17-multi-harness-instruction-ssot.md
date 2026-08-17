# Multi-harness instruction SSOT (2026-08-17)

Research date: **2026-08-17**. Sources are first-party docs, specs, and vendor GitHub repos only. Facts not confirmed in those sources are marked **unknown**. Community tools are labeled **community**.

## Question

How can MyOrganizer keep AI-agent instructions, skills, commands, and sub-agents DRY across Cursor, Claude Code, GitHub Copilot, Gemini CLI, Codex, and related harnesses — without copying a single policy edit into `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`, `.cursor/rules/*.mdc`, `.github/skills/*/SKILL.md`, `.claude/commands/`, `.gemini/commands/`, and `.github/agents/*.agent.md`?

---

## TL;DR

- **No vendor documents a zero-adapter “one paragraph, all harnesses” mechanism.** Closest portable baseline is **`AGENTS.md`** (open format, nested files, no required schema) plus **Agent Skills** (`SKILL.md` under shared `.agents/skills/` or vendor-recognized aliases).
- **Harness-specific filenames still matter:** Claude Code reads **`CLAUDE.md`**, not `AGENTS.md`, unless you **`@`-import or symlink**; Copilot still distinguishes **`.github/copilot-instructions.md`** (repository-wide instructions) from **`AGENTS.md`** (agent instructions); Cursor treats **`AGENTS.md`** and **`.cursor/rules/*.mdc`** as parallel rule systems.
- **Skills are the best cross-vendor workflow SSOT today:** `.agents/skills/` is recognized by Cursor, Codex, Gemini CLI (alias), GitHub Copilot (alias), and Claude Code (`.claude/skills/`). **`npx skills`** (Vercel **`vercel-labs/skills`**, **community** installer) can symlink one canonical skill tree into per-agent paths.
- **Sub-agents cannot share one file as-is:** frontmatter schemas differ (Copilot `.agent.md`, Claude `.md`, Cursor `.md`, Gemini `.md`). **No first-party “generate adapters” spec** exists; MyOrganizer’s `yarn agents:sync` + `<!-- harness:… -->` markers match the problem but are **repo-local**, not vendor-standard.
- **Official DRY patterns that work:** markdown **`@` imports** (Claude `CLAUDE.md`, Gemini `GEMINI.md`), **symlinks** (Claude rules/agents/skills; Codex skills; `npx skills` default), **thin adapter + fat skill**, **nested `AGENTS.md`**, Cursor **`@filename` references** in rules. **MCP resources** are for contextual data, not documented as a substitute for repo instruction files.

---

## 1. Portable instruction files (`AGENTS.md`)

### What `AGENTS.md` is

| Claim                                                                                                 | Source                                                                                 |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Open markdown format for agent-facing repo instructions; **no required fields**; any headings allowed | [agents.md FAQ](https://agents.md/)                                                    |
| Stewarded by the **Agentic AI Foundation under the Linux Foundation** (per agents.md site)            | [agents.md — About](https://agents.md/)                                                |
| Spec repo: format is “just standard Markdown”; website + examples                                     | [agentsmd/agents.md README](https://github.com/agentsmd/agents.md/blob/main/README.md) |
| Nested `AGENTS.md` supported: **closest file to edited path wins**; user chat overrides               | [agents.md FAQ](https://agents.md/)                                                    |
| Migration pattern: rename to `AGENTS.md`, symlink legacy name (`ln -s AGENTS.md AGENT.md`)            | [agents.md FAQ](https://agents.md/)                                                    |

There is **no formal JSON/schema spec** beyond “markdown file named `AGENTS.md`”. The agents.md site lists many adopters (“View all supported agents”); the FAQ documents **Aider** (`read: AGENTS.md` in `.aider.conf.yml`) and **Gemini CLI** (`context.fileName: ["AGENTS.md"]` in `.gemini/settings.json`).

### Which vendors read which files (documented)

| Harness                             | Reads `AGENTS.md`?                                                                                      | Proprietary / parallel files                                                                                         | Notes                                                                                                                                                                                                                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Cursor**                          | **Yes** — project root + nested subdirs; alternative to `.cursor/rules`                                 | `.cursor/rules/*.mdc`, user/team rules                                                                               | [Cursor Rules — AGENTS.md](https://cursor.com/docs/context/rules)                                                                                                                                                               |
| **GitHub Copilot**                  | **Yes** — anywhere in repo; nearest wins for agent instructions                                         | `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md`, optional root `CLAUDE.md` / `GEMINI.md` | [Copilot custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot); [support matrix](https://docs.github.com/en/copilot/reference/custom-instructions-support) |
| **Claude Code**                     | **No by default** — reads `CLAUDE.md` / `.claude/CLAUDE.md`                                             | `CLAUDE.local.md`, `.claude/rules/`                                                                                  | Official bridge: `@AGENTS.md` import or `ln -s AGENTS.md CLAUDE.md`                                                                                                                                                             | [Claude memory — AGENTS.md](https://code.claude.com/docs/en/memory#agentsmd) |
| **Gemini CLI**                      | **Configurable** — default context file is `GEMINI.md`; can add `AGENTS.md` to `context.fileName` array | `GEMINI.md`, hierarchical + JIT loading                                                                              | [Gemini GEMINI.md](https://geminicli.com/docs/cli/gemini-md/)                                                                                                                                                                   |
| **VS Code / Copilot custom agents** | **Yes** (agent instructions) in Copilot Chat per support matrix                                         | `.github/agents/*.agent.md`, `.claude/agents/`                                                                       | [Custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support)                                                                                                                         |
| **OpenAI Codex**                    | **Yes** — scans `.agents/skills` upward in repo; AGENTS.md adoption claimed on agents.md ecosystem page | `.codex/skills`, plugins                                                                                             | [Codex skills](https://developers.openai.com/codex/skills/)                                                                                                                                                                     |
| **Windsurf / Devin Desktop**        | **Yes** — `AGENTS.md` or `agents.md`; location-scoped like rules                                        | `.windsurf/rules/` (legacy), `.devin/rules/`                                                                         | [Devin Desktop AGENTS.md](https://docs.windsurf.com/windsurf/cascade/agents-md)                                                                                                                                                 |
| **Aider**                           | **Yes** — via `read: AGENTS.md` config                                                                  | `.aider.conf.yml`                                                                                                    | [agents.md FAQ](https://agents.md/)                                                                                                                                                                                             |

**Not documented** in sources reviewed: whether **Cursor** reads root `CLAUDE.md` or `GEMINI.md` natively; whether **Copilot** treats `AGENTS.md` as a full replacement for `copilot-instructions.md` (GitHub documents them as **different instruction types** used together on cloud agent).

### Does any vendor treat `AGENTS.md` as replacing proprietary files?

| Vendor             | Replacement?                                                                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude Code**    | **Partial.** `AGENTS.md` is not loaded automatically; **`@AGENTS.md` in `CLAUDE.md`** or **symlink** is the documented pattern. Claude-specific content can sit below the import. |
| **Gemini CLI**     | **Partial.** Configure `context.fileName` to include `AGENTS.md` alongside `GEMINI.md`; default remains `GEMINI.md`.                                                              |
| **Cursor**         | **Partial overlap.** `AGENTS.md` is documented as a **simple alternative** to project rules, not a merge of user rules, team rules, or `.mdc` frontmatter features.               |
| **GitHub Copilot** | **No full replacement.** Repository-wide **`copilot-instructions.md`** remains a separate, documented channel from **`AGENTS.md` agent instructions**. Both may apply.            |

---

## 2. Agent Skills spec (`SKILL.md`)

### Specification and stewardship

| Claim                                                                                           | Source                                                                            |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Open standard; folder + required **`SKILL.md`** with **`name`** + **`description`** frontmatter | [agentskills.io specification](https://agentskills.io/specification)              |
| Originally developed by Anthropic; open to ecosystem contributions                              | [agentskills.io overview](https://agentskills.io/)                                |
| Spec repo: `agentskills/agentskills` on GitHub                                                  | [agentskills/agentskills](https://github.com/agentskills/agentskills)             |
| Validation helper: **`skills-ref validate`** (reference library in spec repo)                   | [agentskills.io specification — Validation](https://agentskills.io/specification) |

Adopters listed on agentskills.io include **Cursor, Claude Code, GitHub Copilot, VS Code, Gemini CLI, Codex**, and many others — each links to vendor docs.

### Discovery paths by vendor (project / user)

| Vendor             | Project paths                                                                                    | User / global paths                                                               | Symlink / alias notes                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Cursor**         | `.agents/skills/`, `.cursor/skills/`; also `.claude/skills/`, `.codex/skills/`                   | `~/.agents/skills/`, `~/.cursor/skills/`, `~/.claude/skills/`, `~/.codex/skills/` | Nested `.cursor/skills/` anywhere in repo; optional `paths` frontmatter | [Cursor skills](https://cursor.com/docs/context/skills)                                                                                                                                    |
| **Claude Code**    | `.claude/skills/`; nested per package                                                            | `~/.claude/skills/`                                                               | Symlinked skill folders supported; commands merged into skills          | [Claude skills](https://code.claude.com/docs/en/skills)                                                                                                                                    |
| **GitHub Copilot** | `.github/skills/`, `.claude/skills/`, `.agents/skills/`                                          | `~/.copilot/skills/`, `~/.agents/skills/`                                         | VS Code: `chat.agentSkillsLocations` for extra paths                    | [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills); [VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) |
| **Gemini CLI**     | `.gemini/skills/` or **`.agents/skills/` alias** (alias wins over `.gemini/skills/` within tier) | `~/.gemini/skills/` or `~/.agents/skills/`                                        | `.agents/skills/` documented as interoperable alias                     | [Gemini CLI skills](https://geminicli.com/docs/cli/skills/)                                                                                                                                |
| **Codex**          | `.agents/skills/` from CWD up to repo root                                                       | `~/.agents/skills/`, `/etc/codex/skills/`                                         | **Supports symlinked skill folders**                                    | [Codex skills](https://developers.openai.com/codex/skills/)                                                                                                                                |

**Can one `SKILL.md` tree be shared without copying?**

- **Documented yes, with constraints:** place skills under **`.agents/skills/`** (widest alias support) or use **`npx skills add … --copy`** vs default **symlink** install (**community** CLI).
- **Copilot-native workflows** often use **`.github/skills/`**; Cursor also reads `.agents/skills/` — MyOrganizer’s **`.github/skills/`** is Copilot-first; Cursor will **not** discover `.github/skills/` unless configured (**unknown** whether `chat.agentSkillsLocations` is set in this repo).
- **Frontmatter extensions differ by vendor** (e.g. Cursor `paths`, `disable-model-invocation`; VS Code `context: fork`; Claude dynamic `!` injection). Shared **`name` + `description` + body** is portable; extended fields may be ignored or behave differently outside the authoring tool.

### `npx skills` / skills.sh

| Claim                                                                                                 | Source                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`npx skills add <source>`** installs skills from GitHub/GitLab/git/local paths                      | [vercel-labs/skills README](https://github.com/vercel-labs/skills/blob/main/README.md)                                                                                 |
| Default install method: **symlink** (recommended); **`--copy`** for agents that don’t follow symlinks | Same                                                                                                                                                                   |
| Project scope: `./<agent>/skills/`; global: `~/<agent>/skills/` per agent table                       | Same                                                                                                                                                                   |
| **`skills.sh`** is the public directory/leaderboard site linked from the README                       | [skills.sh](https://skills.sh/)                                                                                                                                        |
| **`gh skill`** is GitHub’s first-party install/update/publish CLI for Copilot skills                  | [GitHub — add skills](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills#managing-skills-with-github-cli) |

Agent path mapping (examples from README): **Cursor** → `.agents/skills/`; **Claude Code** → `.claude/skills/`; **GitHub Copilot** → `.agents/skills/` (README) / **`~/.copilot/skills/`** (GitHub docs); **Gemini CLI** → `.agents/skills/`.

### GitHub Copilot / VS Code project skills

**Yes — native.** Project skills in `.github/skills/`, `.claude/skills/`, or `.agents/skills/`; personal in `~/.copilot/skills/` or `~/.agents/skills/`. Copilot cloud agent, CLI, code review, VS Code agent mode documented. See [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills).

### Claude commands vs skills

Claude Code **merged custom commands into skills**: `.claude/commands/foo.md` and `.claude/skills/foo/SKILL.md` both expose `/foo`; **skills take precedence** on name collision. Skills add frontmatter, supporting files, and progressive loading. [Claude skills — custom commands merged](https://code.claude.com/docs/en/skills).

---

## 3. Sub-agents / custom agents

### Official locations and schemas

| Harness                            | Locations                                                                             | Filename                              | Frontmatter (documented)                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GitHub Copilot cloud / VS Code** | `.github/agents/`; also `.claude/agents/` in VS Code                                  | `.agent.md` or `.md` in agents folder | `name`, **`description` (required)**, `tools`, `model`, `target`, `disable-model-invocation`, `user-invocable`, `handoffs` (VS Code), `mcp-servers` (cloud) | [Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration); [VS Code custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents) |
| **Cursor**                         | `.cursor/agents/`, `.claude/agents/`, `.codex/agents/`; user `~/.cursor/agents/` etc. | `.md`                                 | `name`, `description`, `model`, `readonly`, `is_background`                                                                                                 | [Cursor subagents](https://cursor.com/docs/agent/subagents)                                                                                                                                              |
| **Claude Code**                    | `.claude/agents/`, `~/.claude/agents/`; managed settings                              | `.md`                                 | `name`, `description`, `tools`, `model`, `memory`, permission modes, etc.                                                                                   | [Claude sub-agents](https://code.claude.com/docs/en/sub-agents)                                                                                                                                          |
| **Gemini CLI**                     | `.gemini/agents/`, `~/.gemini/agents/`                                                | `.md`                                 | **`name` (required)**, **`description` (required)**, `kind`, `tools`, `model`, `temperature`, `max_turns`, …                                                | [Gemini subagents](https://geminicli.com/docs/core/subagents/)                                                                                                                                           |

### Shared canonical body?

**Not documented** by any vendor. Each harness expects **its own file** with **vendor-specific frontmatter** and often different tool naming (`read` vs `Read` vs `read_file`).

**First-party cross-tool compatibility:**

- VS Code reads **`.claude/agents/`** plain `.md` and maps Claude tool names. [VS Code custom agents — Claude agent format](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
- Cursor reads **`.claude/agents/`** and **`.codex/agents/`** for compatibility. [Cursor subagents — file locations](https://cursor.com/docs/agent/subagents)

**Official “generate adapters” pattern:** **not documented.**

**MyOrganizer pattern (repo-local, not vendor-standard):** canonical `.github/agents/*.agent.md` + `yarn agents:sync` + `<!-- harness:claude,cursor --> … <!-- /harness -->` body sections — aligns with the problem shape but is **custom tooling**.

---

## 4. Cursor rules vs skills vs `AGENTS.md`

### Cursor (official)

| Mechanism                   | Role                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **`AGENTS.md`**             | Plain markdown agent instructions; root + nested; simpler than `.mdc`                               | [Cursor rules](https://cursor.com/docs/context/rules)     |
| **`.cursor/rules/*.mdc`**   | Project rules with `alwaysApply`, `description`, `globs`; must use **`.mdc`** (plain `.md` ignored) | Same                                                      |
| **Skills**                  | On-demand workflows; **`/migrate-to-skills`** converts eligible dynamic rules & slash commands      | [Cursor skills](https://cursor.com/docs/context/skills)   |
| **Rules referencing files** | **`@filename.ts`** in rule body; rules can be @-mentioned in chat                                   | [Cursor rules FAQ](https://cursor.com/docs/context/rules) |
| **Remote rules**            | Import `.mdc` from GitHub into `.cursor/rules/imported/`                                            | Same                                                      |

**alwaysApply vs `AGENTS.md`:** Not documented as duplicates. Root `AGENTS.md` is always in scope for Agent; **`alwaysApply: true` rules** are also always included — both can apply; Cursor docs recommend **not duplicating** codebase content and **pointing to canonical examples**.

**Thin pointer to a skill:** Not documented as a dedicated pattern; practical approach is a short rule/skill description + skill body in `.agents/skills/` or `.cursor/skills/`.

### Claude Code

| File                    | Role                                                                            |
| ----------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **`CLAUDE.md`**         | Primary memory; **`@path` imports** (max depth 4); block HTML comments stripped | [Claude memory](https://code.claude.com/docs/en/memory)                      |
| **`AGENTS.md`**         | Import-only bridge (`@AGENTS.md` or symlink)                                    | Same                                                                         |
| **`.claude/commands/`** | Legacy slash commands; superseded by skills                                     | [Claude skills](https://code.claude.com/docs/en/skills)                      |
| **Skills**              | `.claude/skills/`; progressive disclosure                                       | Same                                                                         |
| **`/init`, `/import`**  | Can ingest Cursor rules, Copilot instructions, `AGENTS.md`, Windsurf rules      | [Claude memory — AGENTS.md](https://code.claude.com/docs/en/memory#agentsmd) |

### Gemini CLI

| File                          | Role                                                |
| ----------------------------- | --------------------------------------------------- | ------------------------------------------------------------------ |
| **`GEMINI.md`**               | Default context file; hierarchical + JIT            | [GEMINI.md](https://geminicli.com/docs/cli/gemini-md/)             |
| **`@file.md` imports**        | Modularize context                                  | Same                                                               |
| **`context.fileName`**        | Can list `["AGENTS.md", "CONTEXT.md", "GEMINI.md"]` | Same                                                               |
| **`.gemini/commands/*.toml`** | Custom slash commands (separate from skills)        | [Custom commands](https://geminicli.com/docs/cli/custom-commands/) |
| **Skills**                    | Agent Skills standard; `.agents/skills/` alias      | [Gemini skills](https://geminicli.com/docs/cli/skills/)            |

### GitHub Copilot

| File                          | Role                                                                 |
| ----------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`copilot-instructions.md`** | Repository-wide custom instructions                                  | [Adding custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)                                                             |
| **`AGENTS.md`**               | Agent instructions (anywhere; nearest wins)                          | Same                                                                                                                                                                                           |
| **Custom agents**             | `.github/agents/*.agent.md`                                          | [Create custom agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-custom-agents)                                                                         |
| **Skills vs instructions**    | Instructions for always-on standards; skills for on-demand workflows | [About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills); [VS Code comparison table](https://code.visualstudio.com/docs/copilot/customization/agent-skills) |

---

## 5. DRY patterns that actually work

### Documented vendor mechanisms

| Pattern                              | Where documented                                                    | Works for                                                               |
| ------------------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **`@path` / `@file.md` imports**     | Claude `CLAUDE.md`; Gemini `GEMINI.md`                              | Single markdown SSOT included into harness-specific root files          |
| **Symlink instruction file**         | Claude: `ln -s AGENTS.md CLAUDE.md`; agents.md FAQ                  | Claude + any tool that reads symlink target                             |
| **Symlink skill directories**        | Codex; Claude skills; **`npx skills` default**                      | Cross-agent skills                                                      |
| **Symlink `.claude/rules/` entries** | Claude memory                                                       | Shared rule packs across repos                                          |
| **Nested `AGENTS.md`**               | agents.md; Cursor; Copilot; Windsurf/Devin                          | Monorepo package-scoped policy without one giant file                   |
| **Thin adapter + fat skill**         | Copilot & VS Code explicitly recommend instructions vs skills split | Repo standards in AGENTS.md; workflows in `SKILL.md`                    |
| **Cursor `@file` in rules**          | Cursor rules docs                                                   | Short rules pointing at code or docs                                    |
| **Generated / copied adapters**      | Claude `/import` (one-time copy); **`npx skills --copy`**           | Onboarding, not ongoing SSOT unless scripted (**community** for skills) |

### `@`-imports across harnesses

| Harness                               | `@`-include in instruction roots?                                                             |
| ------------------------------------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Claude Code**                       | **Yes** — `@path` in `CLAUDE.md` / rules                                                      | [Claude memory — Import additional files](https://code.claude.com/docs/en/memory#import-additional-files) |
| **Gemini CLI**                        | **Yes** — `@path` in `GEMINI.md`                                                              | [GEMINI.md — Modularize with imports](https://geminicli.com/docs/cli/gemini-md/)                          |
| **Cursor rules**                      | **`@filename`** references in rule bodies (not full markdown transclusion of arbitrary roots) | [Cursor rules FAQ](https://cursor.com/docs/context/rules)                                                 |
| **Copilot `copilot-instructions.md`** | **Not documented** as `@`-import syntax                                                       | —                                                                                                         |

### One policy paragraph → all harnesses without custom sync?

**Not documented.** Practical minimum today:

1. Author once in **`docs/policy/<topic>.md`** or a section of root **`AGENTS.md`**.
2. **Import** into `CLAUDE.md` / `GEMINI.md` where supported.
3. **Symlink or one-line pointer** for Cursor/Copilot if imports unavailable.
4. Run **repo sync scripts** (like MyOrganizer’s sub-agent sync) for harnesses without import syntax.

### Known failure modes (documented)

| Failure                                                                                   | Source                                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Plain `.md` in `.cursor/rules/` ignored** (must be `.mdc`)                              | [Cursor rules](https://cursor.com/docs/context/rules)                                         |
| **Claude does not read `AGENTS.md` unless bridged**                                       | [Claude memory — AGENTS.md](https://code.claude.com/docs/en/memory#agentsmd)                  |
| **Windows symlink for `CLAUDE.md` needs Admin/Developer Mode** — use `@AGENTS.md` instead | Same                                                                                          |
| **Conflicting instructions** across memory files — Claude/Copilot load multiple layers    | Claude memory; Copilot custom instructions                                                    |
| **Skill name must match directory** — invalid names silently fail in VS Code              | [VS Code agent skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills) |
| **Vendor-specific skill frontmatter** may be ignored elsewhere                            | Claude docs — “Using skill frontmatter outside Claude Code”                                   | [Claude skills](https://code.claude.com/docs/en/skills) |
| **Gemini custom commands are TOML**, not `SKILL.md` — separate duplication surface        | [Gemini custom commands](https://geminicli.com/docs/cli/custom-commands/)                     |

---

## 6. Existing tools / specs / MCP

| Artifact                                                                                              | Type                          | Role in SSOT story                                                                                      |
| ----------------------------------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **[agents.md](https://agents.md/)**                                                                   | Open convention (AAIF)        | Closest cross-agent **instruction file** name                                                           |
| **[agentskills.io](https://agentskills.io/specification)**                                            | Open spec                     | Cross-agent **workflow** packaging                                                                      |
| **[vercel-labs/skills](https://github.com/vercel-labs/skills)** + **[skills.sh](https://skills.sh/)** | **Community** CLI + directory | Multi-agent **skill install/symlink**                                                                   |
| **`gh skill`**                                                                                        | GitHub first-party            | Copilot skill discovery/install/update/publish                                                          |
| **`yarn agents:sync`** (MyOrganizer)                                                                  | **Repo-local**                | Sub-agent adapter generation — no upstream equivalent found                                             |
| **MCP resources**                                                                                     | Protocol                      | Expose **context data** to clients; **not documented** as replacement for checked-in agent policy files | [MCP resources](https://modelcontextprotocol.io/docs/concepts/resources) |

**Instruction compiler / multi-harness sync (first-party):** **Not found** beyond per-vendor import/symlink guidance and Claude **`/import`** one-shot migration.

---

## Unknowns

- Whether **Cursor** discovers **`.github/skills/`** without `chat.agentSkillsLocations` configuration.
- Whether **Copilot Chat in VS Code** auto-reads **`CLAUDE.md`** at repo root (support matrix emphasizes **`AGENTS.md`** for agent instructions).
- Full **AAIF / Linux Foundation** governance doc URL for `AGENTS.md` (agents.md links “Learn more”; dedicated spec page **not fetched** in this research pass).
- **Official Windsurf-only** AGENTS.md page (fetched URL now serves **Devin Desktop** docs; content still describes AGENTS.md behavior).
- Whether any vendor **recommends MCP resources** specifically for **team coding policy** (general MCP resource docs only).

---

## Recommendation for MyOrganizer

**Superseded for the Skill tree:** [ADR 0020](../adr/0020-one-instruction-file-one-skill-tree.md) records the accepted layout. Slice 1 moved repo-native Skills to `.agents/skills/` with `.claude/skills` as a directory symlink. The bullets below are the research-time recommendation and remain useful for Instruction File thinning (slices 2–3).

MyOrganizer already has the right **shape** (canonical agents + sync script; one Skill tree; parallel root instruction files). Official docs suggest tightening layers as follows:

### 1. Make `AGENTS.md` the policy SSOT (repo-wide + nested)

- Keep **one root `AGENTS.md`** for commands, architecture, branch naming, vault rules, gate tiers — content that agents.md/Cursor/Copilot already consume.
- Keep **nested `apps/*/AGENTS.md` and `libs/*/AGENTS.md`** for local conventions (supported by Cursor, Copilot, agents.md nested model).
- **Stop duplicating** the same paragraphs in `CLAUDE.md`, `GEMINI.md`, and `.github/copilot-instructions.md` where imports are available.

### 2. Thin harness adapters (mechanical, small)

| File                                         | Target content                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **`CLAUDE.md`**                              | `@AGENTS.md` + Claude-only blocks (hooks, `/init`, sub-agent sync reminders, tier checklist pointer)                                              | per [Claude AGENTS.md bridge](https://code.claude.com/docs/en/memory#agentsmd)                                                     |
| **`GEMINI.md`**                              | `@AGENTS.md` (after adding to `context.fileName` if not already) + Gemini-only routing to `.gemini/commands/`                                     | [Gemini GEMINI.md](https://geminicli.com/docs/cli/gemini-md/)                                                                      |
| **`.github/copilot-instructions.md`**        | Short pointer to `AGENTS.md` + Copilot-only surfaces (cloud agent onboarding, code-review toggles) — Copilot still uses this file type explicitly | [GitHub custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot) |
| **`CLAUDE.md` / `GEMINI.md` / Copilot file** | Do **not** delete until each harness verified via `/context`, `/memory show`, or Copilot references panel                                         |

### 3. Skills: consolidate on `.agents/skills/` + `.github/skills/` strategy

- **Workflow SSOT:** keep authoritative **`SKILL.md`** under **`.github/skills/<workflow>/`** (Copilot-native, already canonical for MyOrganizer skills).
- **Add symlink or `npx skills add` mapping** so **Cursor/Codex/Gemini** also see skills via **`.agents/skills/`** (documented alias). Prefer **`npx skills add ./.github/skills/... -a cursor -a claude-code --copy` or symlink** after verifying symlink support in CI/devcontainers.
- **Migrate Claude `.claude/commands/*.md`** to **skills** over time (Claude official direction); keep commands as thin wrappers only where Gemini still needs **`.gemini/commands/*.toml`**.
- **Cursor `.cursor/rules/*-workflow.mdc`:** replace duplicated workflow prose with **short rules** that say “when X, use skill Y” or run **`/migrate-to-skills`** for eligible dynamic rules.

### 4. Sub-agents: keep `yarn agents:sync`

- No first-party replacement; continue **`.github/agents/*.agent.md`** as canonical with **`<!-- harness:… -->`** sections.
- Optionally add **VS Code/Copilot `.agent.md` extension** consistently (already used in canonical).

### 5. Commands duplication

| Harness    | Recommendation                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claude** | Point `.claude/commands/*.md` at skills (or delete after skill parity)                                                                      |
| **Gemini** | Keep **`.gemini/commands/*.toml`** as harness-specific thin wrappers referencing `.github/skills/.../SKILL.md` paths in prompts (`@{path}`) |
| **Cursor** | Prefer **skills** over duplicated command docs                                                                                              |

### 6. Do not use MCP as policy SSOT

MCP resources are for **dynamic context**, not documented as the primary store for version-controlled coding policy. Keep policy in git-tracked markdown.

### 7. Verification checklist (after refactors)

- Claude: `/context` shows imported `AGENTS.md`
- Gemini: `/memory show` lists `AGENTS.md` when configured
- Cursor: Customize → Rules / Skills lists expected entries
- Copilot: chat references show `copilot-instructions.md` and/or `AGENTS.md` as intended
- Run existing **`yarn agents:sync:check`**, **`yarn readme:check`**, and spot-check one workflow skill in each harness

---

## Sources

1. [AGENTS.md — home / FAQ](https://agents.md/)
2. [agentsmd/agents.md — GitHub README](https://github.com/agentsmd/agents.md/blob/main/README.md)
3. [Agent Skills — overview](https://agentskills.io/)
4. [Agent Skills — specification](https://agentskills.io/specification)
5. [agentskills/agentskills — GitHub](https://github.com/agentskills/agentskills)
6. [Cursor — Rules (incl. AGENTS.md)](https://cursor.com/docs/context/rules)
7. [Cursor — Agent Skills](https://cursor.com/docs/context/skills)
8. [Cursor — Subagents](https://cursor.com/docs/agent/subagents)
9. [Claude Code — Memory / CLAUDE.md / AGENTS.md bridge](https://code.claude.com/docs/en/memory)
10. [Claude Code — Skills (commands merged)](https://code.claude.com/docs/en/skills)
11. [Claude Code — Sub-agents](https://code.claude.com/docs/en/sub-agents)
12. [Gemini CLI — GEMINI.md / imports / context.fileName](https://geminicli.com/docs/cli/gemini-md/)
13. [Gemini CLI — Agent Skills](https://geminicli.com/docs/cli/skills/)
14. [Gemini CLI — Subagents](https://geminicli.com/docs/core/subagents/)
15. [Gemini CLI — Custom commands (.toml)](https://geminicli.com/docs/cli/custom-commands/)
16. [GitHub Copilot — Adding repository custom instructions](https://docs.github.com/en/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot)
17. [GitHub Copilot — Custom instructions support matrix](https://docs.github.com/en/copilot/reference/custom-instructions-support)
18. [GitHub Copilot — About agent skills](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)
19. [GitHub Copilot — Add skills (cloud)](https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/add-skills)
20. [GitHub Copilot — Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
21. [GitHub Copilot — Creating custom agents](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/cloud-agent/create-custom-agents)
22. [VS Code — Custom agents](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
23. [VS Code — Agent Skills](https://code.visualstudio.com/docs/copilot/customization/agent-skills)
24. [OpenAI Codex — Skills](https://developers.openai.com/codex/skills/)
25. [Devin Desktop / Windsurf — AGENTS.md](https://docs.windsurf.com/windsurf/cascade/agents-md)
26. [Model Context Protocol — Resources](https://modelcontextprotocol.io/docs/concepts/resources)
27. [vercel-labs/skills — README (community)](https://github.com/vercel-labs/skills/blob/main/README.md)
28. [skills.sh — directory (community)](https://skills.sh/)
