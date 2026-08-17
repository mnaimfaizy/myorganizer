# UI Prototype

Adapted from `mattpocock/skills` for MyOrganizer.

Generate **radically different UI variants** for a single surface, switchable with a `?variant=` query param, then pick/merge and delete the rest.

If the question is logic/state-focused, use [LOGIC.md](LOGIC.md).

## Preferred shape

### A) Existing page adjustment (default)

- Keep the same route and data loading.
- Swap only the rendered UI subtree using `?variant=`.

### B) Temporary route (fallback)

- Only when no existing page can host the prototype.
- Use a clearly throwaway route naming pattern and remove after decision.

## Process

1. **State the question and variant count**
   - Default to 3 variants, max 5.
2. **Create structurally different variants**
   - Different hierarchy/layout/primary affordance, not cosmetic-only differences.
3. **Wire variant switch**
   - Read query param and render variant A/B/C.
4. **Add floating variant switcher**
   - Prev/next controls + label.
   - Updates URL query param for shareable/reload-stable state.
   - Keyboard left/right supported (without hijacking focused text inputs).
   - Hidden in production.
5. **Gather decision**
   - Capture what won and why.
6. **Cleanup**
   - Keep winner in real implementation path, delete prototype variants/switcher.

## MyOrganizer constraints

- App route wrappers in `apps/myorganizer/src/app/**` must remain thin; place page logic in `libs/web/pages/<route>/`.
- Follow existing UI conventions and design tokens where practical, but do not over-polish prototype code.
