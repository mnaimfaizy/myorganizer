# Upstream Brief adapter

The adapter is host facts only. The skill body does not name a host. A consuming repo may add `upstream-brief.config.yml` (also `.yaml` or `.json`) at the repository root. Missing file or missing keys use the defaults below.

## Lookup order

1. Repo-root `upstream-brief.config.yml` / `.yaml` / `.json`
2. Defaults in this file

## Keys

| Key | Required | Default | Meaning |
| --- | --- | --- | --- |
| `current_versions.path` | no | `package.json` if present, else ask | File the skill reads to resolve the **current** version of each named subject. Fail closed when a subject is absent. |
| `instruction_globs` | no | See defaults | Repo-owned files that teach agents how to write code. |
| `brief_dir` | no | `docs/research` | Directory for the Upstream Brief. Create it if missing. |
| `source_globs` | no | unset | Optional application-code globs to *sample* for mismatch evidence. |
| `script_globs` | no | unset | Optional hygiene/test-script globs to *sample*. |
| `issue` | no | unset | When omitted, print a proposed issue and do not file. |

### `issue` map

| Key | Meaning |
| --- | --- |
| `tracker` | `github`, `gitlab`, or `none` |
| `repository` | Host `owner/name` when the tracker needs it |
| `labels.research` | Label for “this came from an Upstream Brief” |
| `labels.quality` | Label for code-quality / practice (not a feature) |
| `labels.hitl` | Label meaning a human must decide before an agent implements |

Do not map a dependencies role. Do not add `ready-for-agent`.

## Default `instruction_globs`

```yaml
instruction_globs:
  - AGENTS.md
  - CLAUDE.md
  - GEMINI.md
  - .github/copilot-instructions.md
  - .github/skills/**/*.md
  - .claude/commands/*.md
  - .cursor/rules/*.mdc
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
current_versions:
  path: package.json
brief_dir: docs/research
# source_globs and script_globs omitted — instructions only
# issue omitted — print the proposal, do not file
```
