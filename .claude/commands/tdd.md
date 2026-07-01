# TDD Command

Use this workflow when the user wants to build features or fix bugs test-first (red-green-refactor).

1. Read and follow `.github/skills/tdd/SKILL.md` exactly.
2. Also read `.github/skills/codebase-design/SKILL.md` — referenced during the Refactor step for deep-module vocabulary.
3. **Plan first**: confirm the public interface shape and the prioritized behavior list with the user before writing any code.
4. Work in vertical tracer-bullet slices — one test → one implementation → repeat. Never write all tests before any implementation.
5. Run the full test suite after each GREEN step to confirm no regressions.
6. During Refactor, run `/improve-architecture` if you spot shallow-module candidates worth deepening.
