# Improve Codebase Architecture Command

Scan the codebase for architectural deepening opportunities, present them as a visual HTML report, then grill through whichever candidate you pick.

1. **First**, read `.github/skills/codebase-design/SKILL.md` for the shared vocabulary (module, interface, depth, seam, adapter, leverage, locality). Also read its companion files:
   - `DEEPENING.md` — for classifying each candidate's dependencies
   - `DESIGN-IT-TWICE.md` — for the grilling loop if alternative interfaces are needed
2. Read and follow `.github/skills/improve-codebase-architecture/SKILL.md` exactly.
3. Start with `CONTEXT.md` and `docs/adr/` before exploring the codebase.
4. Delegate the codebase walk to `CodeExplorer` — do not issue 3+ consecutive read/search calls directly.
5. Write the HTML report to `%TEMP%\architecture-review-<timestamp>.html` (Windows) or `$TMPDIR/architecture-review-<timestamp>.html`, then open it with `start <path>` (Windows), `open <path>` (macOS), or `xdg-open <path>` (Linux).
6. Ask the user "Which of these would you like to explore?" before proceeding to the grilling loop.
7. Run the `/grill-with-docs` skill once the user selects a candidate.
