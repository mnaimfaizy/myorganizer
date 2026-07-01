# Prototype Command

Use this workflow when the user needs a quick throwaway prototype to answer a design question before production implementation.

1. Read and follow `.github/skills/prototype/SKILL.md` exactly.
2. Choose the correct branch:
   - Logic/state behavior -> `.github/skills/prototype/LOGIC.md`
   - UI direction comparison -> `.github/skills/prototype/UI.md`
3. Keep prototype code explicitly throwaway and easy to remove.
4. Use existing MyOrganizer tooling and structure (thin app wrappers, page logic in `libs/web/pages/**`).
5. Capture the decision, then delete or absorb prototype code.
