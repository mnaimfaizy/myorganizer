# Upstream Brief adapter

The adapter is host facts only. The skill body does not name a host. A consuming repo may add `upstream-brief.config.yml` (also `.yaml` or `.json`) at the repository root. Missing file or missing keys use the defaults below.

## Lookup order

1. Repo-root `upstream-brief.config.yml` / `.yaml` / `.json`
2. Defaults in this file

## Keys

| Key                   | Required | Default                               | Meaning                                                                                                                                                                                                                                                         |
| --------------------- | -------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `version_record.path` | no       | `package.json` if present, else unset | A file this repo maintains that records versions for humans (a tech-stack table, for example). The Baseline resolver only **compares** it against each Ecosystem's installed version and names a drift note on disagreement — never a source (ADR 0084 item 1). |
| `ecosystems`          | no       | none declared                         | A list of Ecosystem declarations. See below.                                                                                                                                                                                                                    |
| `instruction_globs`   | no       | See defaults                          | Repo-owned files that teach agents how to write code.                                                                                                                                                                                                           |
| `brief_dir`           | no       | `docs/research`                       | Directory for the Upstream Brief. Create it if missing.                                                                                                                                                                                                         |
| `source_globs`        | no       | unset                                 | Optional application-code globs to _sample_ for mismatch evidence.                                                                                                                                                                                              |
| `script_globs`        | no       | unset                                 | Optional hygiene/test-script globs to _sample_.                                                                                                                                                                                                                 |
| `issue`               | no       | unset                                 | When omitted, print a proposed issue and do not file.                                                                                                                                                                                                           |

### `ecosystems` entries

Each entry declares one Ecosystem (ADR 0084 item 2):

| Key              | Required | Meaning                                                                                                        |
| ---------------- | -------- | -------------------------------------------------------------------------------------------------------------- |
| `lead`           | yes      | The lead package name. Its installed version is the Ecosystem's Baseline.                                      |
| `members.add`    | no       | Companion package names the lead's scope convention misses (an unscoped package such as `eslint-config-next`). |
| `members.remove` | no       | Companion package names to drop from the discovered set.                                                       |

Members are otherwise discovered by the lead's npm scope prefix: `nx` names companions
installed under `@nx/*`; a lead already scoped (`@remix-run/react`) names companions under its
own scope (`@remix-run/*`). The Baseline resolver — `.agents/skills/upstream-brief/baseline.mjs`
(dependency-free) plus `resolve-baseline.mjs` (its CLI) — ships inside the skill, like the report
validator. An Ecosystem whose lead is not installed fails closed with a reason and does not stop
the rest from resolving.

```yaml
ecosystems:
  - lead: nx
  - lead: next
    members:
      add: [eslint-config-next]
      remove: []
```

### `issue` map

| Key               | Meaning                                                      |
| ----------------- | ------------------------------------------------------------ |
| `tracker`         | `github`, `gitlab`, or `none`                                |
| `repository`      | Host `owner/name` when the tracker needs it                  |
| `labels.research` | Label for “this came from an Upstream Brief”                 |
| `labels.quality`  | Label for code-quality / practice (not a feature)            |
| `labels.hitl`     | Label meaning a human must decide before an agent implements |

Do not map a dependencies role. Do not add `ready-for-agent`.

## Default `instruction_globs`

```yaml
instruction_globs:
  - AGENTS.md
  - CLAUDE.md
  - GEMINI.md
  - .github/copilot-instructions.md
  - .agents/skills/**/*.md
  - .claude/commands/*.md
```

Always exclude, even when a glob would match:

```text
node_modules/**
.yarn/**
vendor/**
.git/**
**/generated/**
```

Third-party skill install trees are not repo-owned. Do not add them to `instruction_globs`. If a hop shows an installed third-party skill contradicting upstream, record **follow-on**: update or pin that skill.

## Example

```yaml
version_record:
  path: package.json
ecosystems:
  - lead: nx
brief_dir: docs/research
# source_globs and script_globs omitted — instructions only
# issue omitted — print the proposal, do not file
```
