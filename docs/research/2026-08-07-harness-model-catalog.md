# Harness model catalogs & cost semantics (2026-08-07)

Research date: **2026-08-07**. Sources are first-party docs only. Facts not confirmed in those sources are marked **unknown**.

## Question

For GitHub Copilot custom agents, Cursor agents, Claude Code subagents, and Gemini CLI agents: what model identifiers work in frontmatter/config, what deprecation/catalog APIs exist, how pricing maps to session cost, what telemetry is exposed, and what limits block deterministic monthly cost automation — compared to MyOrganizer’s assignments in `.github/agents`, `.claude/agents`, `.cursor/agents`, `.gemini/agents`, and Sandcastle routing in `.sandcastle/main.mts`.

---

## TL;DR

- **Four different identifier schemes**: Copilot uses **display names** (often `Name (copilot)`); Claude Code uses **aliases** (`haiku`/`sonnet`/`opus`/`fable`/`inherit`) or **full IDs** (`claude-opus-5`); Cursor subagents use **slug IDs** (`composer-2.5`, `grok-4.5`) plus bracket params; Gemini agents use **API model strings** (`gemini-3.6-flash`) with heavy **runtime resolution/fallback**.
- **No harness exposes a stable, public “model catalog API”** suitable for offline automation. Closest: Cursor SDK `Cursor.models.list()`; Gemini embeds catalogs in `settings.json` defaults; GitHub publishes HTML tables only.
- **Billing is token- or credit-based with plan pools, routing, and fallbacks** — session cost is not derivable from frontmatter alone.
- **Repo alignment**: the implementation following this research migrated Gemini agents to current 3.x IDs, replaced undocumented `grok-4.5-xhigh`, and moved Sandcastle from retired Composer 2 and Claude 4.x defaults to current documented identifiers.

---

## 1. GitHub Copilot custom agents (`.github/agents/*.agent.md`)

### Valid model identifiers

| Source                                                                                                  | Format                                                                                                                                                                |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration) | Frontmatter `model`: **string** (single model).                                                                                                                       |
| [Custom agents in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-agents)      | `model`: **string or prioritized array** of model names. Handoffs use qualified names: `Model Name (vendor)` e.g. `Claude Sonnet 4.5 (copilot)`, `GPT-5.2 (copilot)`. |
| [Supported AI models](https://docs.github.com/en/copilot/reference/ai-models/supported-models)          | Authoritative **display names** (GA / preview), e.g. `GPT-5.6 Luna`, `Claude Sonnet 5`, `Gemini 3.6 Flash`, `Grok 4.5`, `Kimi K2.7 Code`, `MAI-Code-1-Flash`.         |

**MyOrganizer usage** (all 19 agents): arrays of qualified names, e.g. `model: ['GPT-5.6 Luna (copilot)']`, `['Claude Sonnet 5 (copilot)']`, `['Gemini 3.6 Flash (copilot)']`, `['Grok 4.5 (copilot)']`, `['Kimi K2.7 Code (copilot)']`, `['MAI-Code-1-Flash (copilot)']`, `['Claude Haiku 4.5 (copilot)']`. These match the supported-models table.

**Note**: GitHub.com Copilot cloud agent docs state `model` exists but VS Code-only fields (`handoffs`, `argument-hint`) are ignored on GitHub.com; cloud `model` support vs IDE may differ by surface — **verify in your Copilot client version**.

### Deprecation / catalog API

- **Retirement schedule**: [Supported models — Model retirement history](https://docs.github.com/en/copilot/reference/ai-models/supported-models#model-retirement-history) (e.g. Claude Sonnet 4.5 → Claude Sonnet 5 on **2026-09-01**; Gemini 3.1 Pro → Gemini 3.6 Flash on **2026-09-01**).
- **Machine-readable catalog API**: **Not documented** in GitHub first-party docs reviewed. Catalog is published as documentation tables + [Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing).

### Pricing / cost semantics

- **Current (usage-based)**: Interactions convert **tokens → GitHub AI Credits** (1 credit = **$0.01 USD**). Per-model **$/1M tokens** in [Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing). Plan allowances: Pro **1,500**, Pro+ **7,000**, Max **20,000** credits/month ([Usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)).
- **Legacy (annual Pro/Pro+ request billing)**: Premium requests × **model multipliers** ([Requests in Copilot (legacy)](https://docs.github.com/en/copilot/concepts/billing/copilot-requests), [Model multipliers for annual plans](https://docs.github.com/en/copilot/reference/copilot-billing/request-based-billing-legacy/model-multipliers-for-annual-plans)). Copilot Chat/CLI: **1 premium request × multiplier per user prompt**; agentic tool calls do not multiply separately.
- **Auto model**: 10% discount on model costs when using Auto ([Usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)).

### Telemetry

- Usage dashboard in GitHub **Billing & licensing** / **Plans and usage** (exact path varies by billing platform).
- Token-level detail via AI credits consumption; legacy plans use premium-request counters.
- **No documented per-subagent token export** in agent frontmatter workflow.

### Limits blocking deterministic monthly automation

- Monthly credit allowances **reset UTC calendar month**; unused credits **do not roll over**.
- **Variable tokens per session** (conversation length, agentic multi-call, model choice, long-context tiers).
- **Auto model selection** and org **model policies** change effective model without config edits.
- **Rate limits** under high demand ([Usage limits](https://docs.github.com/en/copilot/concepts/usage-limits) — referenced from billing docs).

---

## 2. Cursor agents (`.cursor/agents/*.md`)

### Valid model identifiers

| Source                                                                                         | Format                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Subagents — Model configuration](https://cursor.com/docs/agent/subagents#model-configuration) | `model: inherit` or a **specific model ID** (examples: `composer-2`, `gpt-5.6-sol`). Bracket params: `composer-2.5[fast=false]`, `claude-opus-5[effort=high]`. |
| [Models & pricing](https://cursor.com/docs/models)                                             | Display names + pricing table; slugs appear in notes (e.g. `claude-opus-4-8-fast`, `claude-opus-5-fast`).                                                      |
| [TypeScript SDK](https://cursor.com/docs/sdk/typescript)                                       | `model: { id: "composer-2.5", params: [...] }`. **`composer-2` / `composer-2-fast` retired** → rerouted to Composer 2.5 at auth time.                          |
| [Cursor.models.list()](https://cursor.com/docs/sdk/typescript#cursormodelslist)                | **Account-specific** discovery of valid ids and params.                                                                                                        |

**MyOrganizer usage** (19 agents):

| Model in repo  | Agents                                                          |
| -------------- | --------------------------------------------------------------- |
| `composer-2.5` | Most agents, including test-scaffold, test-runner, and research |
| `grok-4.5`     | component-reviewer, e2e-planner                                 |

**Gaps vs official docs**:

- `composer-2.5` / `composer-2.5-fast`: consistent with [Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5) and SDK (`fast` param).
- `grok-4.5`: consistent with [Grok 4.5](https://cursor.com/docs/models/grok-4-5). The undocumented `grok-4.5-xhigh` slug found during research was removed.

### Deprecation / catalog API

- Pricing/docs pages list models and retirement notes (e.g. Composer 2 → 2.5 in SDK).
- **Catalog API**: `Cursor.models.list()` (SDK) for programmatic discovery; no static global JSON catalog URL documented.

### Pricing / cost semantics

- **Two usage pools** ([Models & pricing](https://cursor.com/docs/models)):
  - **Cursor Models**: Composer 2.5, Cursor Grok 4.5 — “generous included usage” (not fixed token counts).
  - **Other Models**: Third-party models at **API $/M tokens**; Pro includes **≥$20**/month (tier-dependent).
- **Composer 2.5**: Standard **$0.50 / $2.50** per M input/output; Fast **$3 / $15** ([Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5)).
- **Grok 4.5**: Standard **$2 / $6**; Fast **$4 / $18** per M tokens ([Grok 4.5](https://cursor.com/docs/models/grok-4-5)).
- **Teams**: +**$0.25/M tokens** Cursor Token Rate on third-party models.
- Subagents **bill independently** (separate context windows) ([Subagents](https://cursor.com/docs/agent/subagents)).

### Telemetry

- [Usage dashboard](https://cursor.com/dashboard/usage) (pools, on-demand spend).
- SDK/streaming exposes usage on runs (**unknown** detail for subagent-only breakdown in frontmatter files).

### Limits blocking deterministic monthly automation

- Included usage described as **“generous”** without fixed token budgets in public docs.
- **Model fallback** when plan/admin blocks configured model ([Subagents — When configured model won't be used](https://cursor.com/docs/agent/subagents#when-the-configured-model-wont-be-used)).
- **Fast vs standard** defaults differ (Composer defaults to Fast in product).
- **Cursor Router / Auto** routes unpredictably unless model pinned.

---

## 3. Claude Code subagents (`.claude/agents/*.md`)

### Valid model identifiers

| Source                                                                                   | Format                                                                                                                                                    |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Sub-agents — Choose a model](https://code.claude.com/docs/en/sub-agents#choose-a-model) | Aliases: `sonnet`, `opus`, `haiku`, `fable`, `inherit`. Full IDs: e.g. `claude-opus-5`, `claude-sonnet-5` (same as `--model`).                            |
| [Model configuration](https://code.claude.com/docs/en/model-config)                      | Also: `default`, `best`, `sonnet[1m]`, `opus[1m]`, `opusplan`. Alias **resolution varies by provider** (Anthropic API: `opus`→Opus 5, `sonnet`→Sonnet 5). |
| Resolution order                                                                         | `CLAUDE_CODE_SUBAGENT_MODEL` → per-invocation param → frontmatter → main session model.                                                                   |

**MyOrganizer usage** (19 agents):

| Frontmatter | Agents                                          |
| ----------- | ----------------------------------------------- |
| `haiku`     | 14 agents (default cheap path)                  |
| `sonnet`    | research, docs, component-reviewer, e2e-planner |
| `inherit`   | test-runner only                                |

**Built-in Explore** (v2.1.198+): inherits main session model (capped at Opus on Anthropic API), **not** always Haiku — custom `Explore` subagent with `model: haiku` overrides ([Sub-agents](https://code.claude.com/docs/en/sub-agents)).

### Sandcastle vs Claude frontmatter (`.sandcastle/main.mts`)

Sandcastle passes **API-style strings** to `claudeCode()`, not frontmatter aliases:

| Complexity label    | Sandcastle model   |
| ------------------- | ------------------ |
| `complexity:high`   | `claude-opus-5`    |
| `complexity:medium` | `claude-sonnet-5`  |
| default / low       | `claude-haiku-4-5` |

Override via `SANDCASTLE_MODEL`, `SANDCASTLE_CLAUDE_MODEL`, or `--model`.

Sandcastle now uses the current Claude Code full IDs for Opus and Sonnet. Haiku remains `claude-haiku-4-5`.

### Deprecation / catalog API

- Warnings for retiring models in CLI ([Model configuration](https://code.claude.com/docs/en/model-config)); headless JSON exposes actual model in `modelUsage`.
- **No public catalog HTTP API** documented.

### Pricing / cost semantics

- Subscription plans (Pro/Max/Team/Enterprise) with included usage; **API billing** per token for API-key workflows ([Manage costs](https://code.claude.com/docs/en/costs)).
- `/usage` shows session token breakdown by model (API users); subscribers see plan bars.
- Subagent attribution in `/usage` (skills, subagents, MCP %) ([Manage costs](https://code.claude.com/docs/en/costs)).
- **Effort levels** (`low`–`max`) affect token spend ([Model configuration — Effort](https://code.claude.com/docs/en/model-config)).

### Telemetry

- Interactive: `/usage`
- Headless: `modelUsage` in result message ([Headless](https://code.claude.com/docs/en/headless))
- OpenTelemetry export ([Monitoring usage](https://code.claude.com/docs/en/monitoring-usage))
- Sandcastle: `logRunUsage()` in `.sandcastle/main.mts` aggregates `inputTokens`, cache read/write, `outputTokens` when provider returns them

### Limits blocking deterministic monthly automation

- **`inherit` + main session model** makes subagent cost depend on parent routing.
- **`CLAUDE_CODE_SUBAGENT_MODEL` env** overrides all frontmatter.
- **Alias drift** (`haiku`/`sonnet`/`opus` map to newest version over time).
- **Org `availableModels` allowlist** substitutes or blocks configured models.
- Explore no longer fixed to Haiku unless you define a custom Explore agent.

---

## 4. Gemini CLI agents (`.gemini/agents/*.md`)

### Valid model identifiers

| Source                                                                                        | Format                                                                                                                                        |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [Subagents — Configuration schema](https://geminicli.com/docs/core/subagents/)                | Frontmatter `model`: string, e.g. `gemini-3-flash-preview`; default **`inherit`** (session model).                                            |
| [Model selection](https://geminicli.com/docs/cli/model/)                                      | Session `/model` and `--model`: `gemini-2.5-pro`, `gemini-2.5-flash`, Auto aliases, preview models. **Subagents not overridden by `/model`**. |
| [Configuration reference — modelConfigs](https://geminicli.com/docs/reference/configuration/) | Embedded **`modelDefinitions`**, **`modelIdResolutions`**, **`modelConfigs.aliases`** (machine-readable defaults in docs).                    |

**MyOrganizer usage**:

| Model                   | Agents                                                   |
| ----------------------- | -------------------------------------------------------- |
| `gemini-3.6-flash`      | Generation, synthesis, and review agents                 |
| `gemini-3.5-flash-lite` | commit, dep-sync, explore, preflight-check, version-bump |

The implementation following this research adopted current GA Gemini 3.x IDs and avoided preview-only Pro assignments.

### Deprecation / catalog API

- Model chains / resolution rules in [Configuration reference](https://geminicli.com/docs/reference/configuration/) (`modelConfigs.modelChains`, `modelIdResolutions`) — **conditional fallbacks** (preview access, feature flags).
- **No standalone public REST catalog**; catalog is **settings defaults + CLI `/model` UI**.

### Pricing / cost semantics

- **Quota model**, not pure per-agent token pricing for most users ([Quotas and pricing](https://geminicli.com/docs/resources/quota-and-pricing/)):
  - Google sign-in: **1,000–2,000 requests/user/day** by tier
  - API key free: **250 requests/day**, Flash only
  - Pay-as-you-go: **varies** by model/token ([Gemini API pricing](https://ai.google.dev/gemini-api/docs) — linked from Gemini docs)
- **`/stats model`**: session token usage + limits ([Quotas and pricing](https://geminicli.com/docs/resources/quota-and-pricing/)).

### Telemetry

- `/stats model` during session; summary on exit
- Optional OpenTelemetry ([Configuration — telemetry](https://geminicli.com/docs/reference/configuration/))
- Usage statistics (anonymized) unless opted out

### Limits blocking deterministic monthly automation

- **Daily request caps** (primary limit for fixed-tier users).
- **Model routing / fallback chains** change effective model (`gemini-2.5-flash` may resolve to `gemini-3.5-flash` under flags).
- **Subagent model independent of session `/model`** → usage reports mix models.
- **Preview access flags** (`hasAccessToPreview`, etc.) alter resolution.
- Antigravity CLI migration noted for some tiers (**2026-06-18** in quota doc) — **unknown** impact on agent config long-term.

---

## 5. Cross-harness comparison

| Dimension                      | Copilot               | Cursor               | Claude Code              | Gemini CLI                     |
| ------------------------------ | --------------------- | -------------------- | ------------------------ | ------------------------------ |
| **Config field**               | `model` string/array  | `model` string       | `model` alias/ID         | `model` API string             |
| **Display vs slug**            | Display + `(copilot)` | Slugs + `[params]`   | Aliases + `claude-*` IDs | API ids (`gemini-3.6-flash`)   |
| **Catalog API**                | Docs tables only      | SDK `models.list()`  | None documented          | `settings.json` schema in docs |
| **Unit of billing**            | AI credits (tokens)   | $ pools + $/M tokens | Plan + tokens            | Requests/day or $/token        |
| **Subagent telemetry**         | Not documented        | Dashboard (pools)    | `/usage`, OTEL           | `/stats model`                 |
| **Deterministic monthly cost** | **No**                | **No**               | **No**                   | **No**                         |

---

## 6. MyOrganizer assignment summary

### Harness agent files (19 agents each)

| Harness          | Distinct models assigned                                                           | Cost tier intent (inferred)                                |
| ---------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `.github/agents` | Luna, Flash 3.6, Sonnet 5, Grok 4.5, Terra, Kimi K2.7, MAI-Code-1-Flash, Haiku 4.5 | Copilot catalog-aligned; flash/light vs sonnet/grok review |
| `.claude/agents` | `haiku`, `sonnet`, `inherit`                                                       | Aggressive haiku default; sonnet for research/docs         |
| `.cursor/agents` | `composer-2.5`, `grok-4.5`                                                         | Standard Composer pool + Grok for review/planning          |
| `.gemini/agents` | `gemini-3.6-flash`, `gemini-3.5-flash-lite`                                        | Current GA Flash models; Lite for deterministic work       |

### Sandcastle (`.sandcastle/main.mts`) — not agent frontmatter

| Provider  | Default / routing                                                                | Notes vs repo harness                                                                 |
| --------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `claude`  | `claude-opus-5` / `claude-sonnet-5` / `claude-haiku-4-5` by slice `complexity:*` | Current full IDs rather than frontmatter family aliases                               |
| `cursor`  | `composer-2.5`                                                                   | Aligned with `.cursor/agents`                                                         |
| `copilot` | `claude-sonnet-5`                                                                | Current provider slug; GitHub agents use **`Claude Sonnet 5 (copilot)`** display name |

Sandcastle token logging: aggregates per-iteration usage when provider returns telemetry; otherwise logs _"usage unavailable"_.

---

## 7. Recommendations for MyOrganizer

1. **Treat frontmatter models as hints, not cost contracts** — automate budgets from each vendor’s dashboard/API (Cursor usage, Copilot AI credits, Claude `/usage` or OTEL, Gemini `/stats`), not from static agent files.
2. **Reconcile Sandcastle Cursor default** — completed: `composer-2.5`.
3. **Remove undocumented `grok-4.5-xhigh`** — completed: use `grok-4.5`.
4. **Align Sandcastle Claude IDs** — completed for Opus and Sonnet; validate provider telemetry on the next run.
5. **Track GitHub retirements** (2026-09-01 batch) for Sonnet 4.x / Opus 4.x names if Copilot picks substitute models automatically.
6. **Gemini** — completed: current GA 3.x assignments are governed by `tools/config/agent-model-policy.json`.

---

## Sources

1. [GitHub Copilot — Custom agents configuration](https://docs.github.com/en/copilot/reference/custom-agents-configuration)
2. [VS Code — Custom agents in VS Code](https://code.visualstudio.com/docs/copilot/customization/custom-agents)
3. [GitHub Copilot — Supported AI models](https://docs.github.com/en/copilot/reference/ai-models/supported-models)
4. [GitHub Copilot — Models and pricing](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
5. [GitHub Copilot — Usage-based billing for individuals](https://docs.github.com/en/copilot/concepts/billing/usage-based-billing-for-individuals)
6. [GitHub Copilot — Requests (legacy premium)](https://docs.github.com/en/copilot/concepts/billing/copilot-requests)
7. [Cursor — Subagents](https://cursor.com/docs/agent/subagents)
8. [Cursor — Models & pricing](https://cursor.com/docs/models)
9. [Cursor — Composer 2.5](https://cursor.com/docs/models/cursor-composer-2-5)
10. [Cursor — Grok 4.5](https://cursor.com/docs/models/grok-4-5)
11. [Cursor — TypeScript SDK](https://cursor.com/docs/sdk/typescript)
12. [Cursor — Available models (help)](https://cursor.com/help/models-and-usage/available-models)
13. [Claude Code — Sub-agents](https://code.claude.com/docs/en/sub-agents)
14. [Claude Code — Model configuration](https://code.claude.com/docs/en/model-config)
15. [Claude Code — Manage costs](https://code.claude.com/docs/en/costs)
16. [Gemini CLI — Subagents](https://geminicli.com/docs/core/subagents/)
17. [Gemini CLI — Model selection](https://geminicli.com/docs/cli/model/)
18. [Gemini CLI — Configuration reference](https://geminicli.com/docs/reference/configuration/)
19. [Gemini CLI — Quotas and pricing](https://geminicli.com/docs/resources/quota-and-pricing/)
