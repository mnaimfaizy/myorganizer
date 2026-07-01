# Logic Prototype

Adapted from `mattpocock/skills` for MyOrganizer.

Use this when the question is about **business logic, state transitions, or data shape** and you need to drive the model interactively.

## Use this shape when

- Edge-case transitions are hard to reason about on paper.
- You want to validate reducer/state-machine behavior before production code.
- You need to feel out interface shape with fast feedback.

If the question is visual/layout-focused, use [UI.md](UI.md) instead.

## Process

1. **State the question**
   - Record the exact question being answered in the prototype file header or nearby notes.
2. **Use existing runtime/tooling**
   - Match current project conventions; do not introduce new package managers/runtimes.
3. **Isolate portable logic**
   - Keep prototype logic behind a small pure surface (reducer/state machine/pure functions/small module).
   - Keep terminal shell separate from logic.
4. **Build the smallest interactive shell**
   - Render current state and available actions after each input.
   - Re-render the frame each interaction for easy comparison.
5. **Make it runnable in one command**
   - Add a single run entry via existing scripts/targets where appropriate.
6. **Hand over**
   - Share command and expected interactions.
7. **Capture conclusion**
   - Save what was learned, then remove throwaway shell code.

## Anti-patterns

- Adding tests for the throwaway shell.
- Using production persistence by default.
- Over-generalizing beyond the single question.
- Mixing terminal I/O with logic internals.
