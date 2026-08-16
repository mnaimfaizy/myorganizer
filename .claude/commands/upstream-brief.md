# Upstream Brief Command

Write one Upstream Brief comparing repo-owned instructions to official docs.

1. Read and follow `.github/skills/upstream-brief/SKILL.md` exactly.
2. Require `subject@version` tokens from the user (example: `next@16 react@19`). Do not fetch “latest.”
3. Resolve current versions from the host adapter (`upstream-brief.config.yml`).
4. Fan out Independent Hops — one research worker per subject — against primary upstream pages only.
5. Write the brief under the adapter’s `brief_dir`. Apply no instruction or code edits.
6. If there is a finding, propose a HITL issue and file it only on confirm. Do not start `/grill-with-docs`.

## Usage

```
/upstream-brief next@16
/upstream-brief next@16 react@19 express@5
```

## Reference

- Skill: `.github/skills/upstream-brief/SKILL.md`
- Adapter schema: `.github/skills/upstream-brief/ADAPTER.md`
- Host adapter: `upstream-brief.config.yml`
- Contract: `docs/adr/0018-upstream-brief-portable-instruction-audit.md`
