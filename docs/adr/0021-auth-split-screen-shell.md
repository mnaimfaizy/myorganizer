# Auth routes use a shared split-screen shell

Auth screens (login, signup, forgot, set-password, verify, check-email) share one visual system: form on the left, hero on the right (`AuthSplitShell`). That choice was made against two prototype variants at `/prototype/auth` (removed after absorption) on 2026-07-25.

## Considered Options

- **Option A — Split screen** (adopted): form left / hero right; Plus Jakarta Sans headings + Inter body; purple primary CTAs from the design-token secondary; navy headings; muted slate supporting copy; SVG placeholder heroes until generated images are chosen.
- **Option B — Gradient welcome card**: rejected; the split layout scales across every auth route without a per-page welcome treatment.
- **Option C — Centered focus**: rejected; it drops the hero and makes auth feel like a different product from the rest of the app.
