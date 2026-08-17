# Ask Matt Command

Use this workflow when it is unclear which MyOrganizer skill or sequence should be used next.

1. Read and follow `.agents/skills/ask-matt/SKILL.md` exactly.
2. Route the request to the correct flow:
   - Planned feature -> `/to-prd` then `/to-issues`
   - Something's broken (hard bug) -> `/diagnosing-bugs`
   - Design uncertainty -> `/grill-with-docs`
   - Stale framework / library instructions -> `/upstream-brief`
   - Vocabulary/shape -> `/domain-modeling` / `/codebase-design`
   - Runnable exploration needed -> `/prototype` (and `/handoff` if crossing sessions)
   - Ad-hoc implement -> classify gate -> `/implement` (+ `/tdd` when appropriate)
   - Test updates -> `/unit-test-delegation-workflow` or `/playwright-e2e-workflow`
3. Prefer repository-native workflows and avoid invented process branches.
