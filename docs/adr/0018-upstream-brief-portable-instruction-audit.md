# Upstream Briefs audit instruction truth against official docs

Agent training data and even installed vendor skills go stale (the Research agent still said Next.js 14 while `TECH_STACK.md` listed Next.js 16). We will use a user-invoked, portable skill that writes one **Upstream Brief** per run: a cited comparison of repo-owned instructions and hygiene scripts against official upstream docs for subjects and target versions the human names. It is not a dependency upgrade, not DepAudit, and not DepSync.

## Status

accepted

## Decision

- One user-invoked skill. Parallelism is Independent Hops (one research worker per named subject), not a catalog of per-framework skills.
- The human names each subject and its target version. The host adapter resolves current versions. The skill never fetches “latest.”
- The adapter is optional and defaultable: current-version source, instruction globs, brief directory. Optional source/script globs and an issue map. This repo is consumer #1, not the skill’s native vocabulary.
- A finding is valid only from a primary upstream page for the named target. The training corpus, blogs, and vendor skills are not sources.
- The brief records future-risk, mismatch, and missed improvement, plus a proposed plan. Nothing is applied.
- The plan may change repo-owned instructions and hygiene/test scripts only. Application-code findings and vendor-skill contradictions are follow-on (separate issue, or update/pin the installed skill).
- If there is at least one finding, the skill proposes a HITL issue and files it only on confirm. Default roles: `research`, `quality` → `qa`, `hitl` → `type:hitl`. No `dependencies`. No `ready-for-agent`. The human starts `/grill-with-docs`; the skill does not.
- A failed hop still yields a partial brief. An issue is proposed only for subjects that produced findings.

## Considered Options

- **Upgrade-planning skill, or fold into DepAudit / DepSync** — rejected. DepAudit answers “what is outdated or vulnerable.” DepSync writes version numbers after an install ([ADR 0001](0001-tech-stack-single-source-of-truth.md)). This skill answers “what do official docs say now, and which of our instructions are wrong?”
- **MyOrganizer-native first, extract later** — rejected. The skill will be exported. Baking in `TECH_STACK.md` or `type:hitl` makes the extract a rewrite.
- **One skill per ecosystem** — rejected. A `next-upstream` skill that embeds “use `middleware`” becomes the sediment this work exists to kill.
- **Skill looks up latest** — rejected. “Latest” is as stale as the training corpus, and the human sometimes wants a major that is not the newest on the registry.
- **Auto-file every run, or start the grill in the same run** — rejected. Empty briefs are tracker noise. The human starts the grill and decides what is valuable.
- **Write instruction patches before the grill** — rejected. That makes HITL theatre.
- **One issue for instructions and application code** — rejected. That is the mega-ticket slice rules already refuse, and it travels badly to other repos.
- **Edit installed vendor skill bodies** — rejected. That forks a third-party skill. Record “update or pin” as follow-on.

## Consequences

- `CONTEXT.md` defines **Upstream Brief**. The portable skill lives at `.agents/skills/upstream-brief/`. This repo’s adapter is `upstream-brief.config.yml`.
- The adapter reads current versions from `TECH_STACK.md`, writes briefs under `docs/research/`, and maps issue roles as above.
- DepSync remains the only writer of version claims. DepAudit remains the outdated/vulnerability report. Vendor skills in `EXTERNAL_SKILLS.md` stay a consumption path, not a source of truth.
