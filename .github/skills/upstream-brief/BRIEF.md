# Upstream Brief file

Write one Markdown file per run. Date it. Cite every finding. Propose a plan; apply nothing.

## Filename

`YYYY-MM-DD-upstream-brief-<subject>-<subject>.md` in `brief_dir`.

Use lowercase subject tokens from the invocation (`next`, `react`). Join with hyphens.

## Template

```md
# Upstream Brief: <subjects>

- **Date:** <ISO date>
- **Subjects:**
  - `<subject>` current `<resolved or failed>` → target `<named>`
- **Sources:** primary upstream pages only (linked on each finding)

## Findings

### <subject>

#### Future-risk | Mismatch | Missed improvement

- **Claim:** <one sentence>
- **Source:** [title](url) — <target version the page describes>
- **Local evidence:** <instruction or sampled script/usage, or “none in scanned files”>
- **Disposition:** plan | follow-on

(Repeat per finding. Omit a type heading when that type has no findings.)

## Proposed plan

Repo-owned instructions and hygiene/test scripts only. Name the *kind* of file to change and what it should start saying. Hosts may add paths. No package bumps. No application-code edits.

- <change>

If there are no plan items, write `_None._`

## Follow-on

Application-code findings and third-party-skill contradictions. The human may file a separate issue after grilling.

- <item> — code | vendor-skill

If there are none, write `_None._`

## Failed hops

- `<subject>` — <why current version or research failed>

If there are none, write `_None._`
```

## Finding types

| Type | Meaning |
| --- | --- |
| **Future-risk** | Official docs mark a feature this repo’s instructions still teach as changing or deprecated. |
| **Mismatch** | Repo-owned instructions or sampled scripts/usage disagree with official docs for the named target. |
| **Missed improvement** | Official docs show a better practice; the app may still build. |

A finding without a primary-source URL is not a finding. When two official pages disagree, record both and do not pick a winner.
