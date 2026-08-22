# Modern Web Guidance Evaluation

Date: August 15, 2026

Related work: issue #195 and PR #255

## Decision

Approve `GoogleChrome/modern-web-guidance@modern-web-guidance` for the default project-scope install set. Install the named skill explicitly:

```sh
npx skills add GoogleChrome/modern-web-guidance --skill modern-web-guidance -y
```

The repository-level command documented upstream is valid, but its non-interactive form installs both exported skills. MyOrganizer does not build a Chrome extension, so installing the separate `chrome-extensions` skill adds unrelated instructions and unnecessary agent context.

## Project Installation

The approved skill is installed in this repository and tracked through the Skills CLI's universal project layout:

- `.agents/skills/modern-web-guidance/` contains the upstream manifest and guide corpus used by GitHub Copilot, Cursor, OpenCode, and other compatible agents.
- `.claude/skills/modern-web-guidance` links to the universal installation for Claude Code.
- `skills-lock.json` records the source, skill path, and computed content hash.

The installation contains only `modern-web-guidance`; `chrome-extensions` is intentionally absent. Use the CLI to inspect or refresh the generated files instead of editing them directly:

```sh
npx skills list
npx skills check
npx skills update -p
```

The skill invokes its search and retrieval CLI on demand, so no application runtime dependency is required. Set `DISABLE_TELEMETRY=1` when running its CLI where telemetry is not acceptable.

## Fit

The skill covers 103 web platform features and 131 use cases across CSS, HTML and DOM APIs, JavaScript, performance, accessibility, forms, security, privacy, and UI behavior. It is useful to MyOrganizer's Next.js and React frontend because it complements the existing framework-focused skills with browser-platform guidance, including:

- INP and LCP diagnostics, task scheduling, fetch priority, and deferred rendering;
- accessible post-interaction form validation and browser autofill;
- dialogs, popovers, anchor positioning, and progressive enhancement;
- WebAuthn and passkey flows relevant to authentication work;
- date, time, internationalization, and recurring interval guidance relevant to organizer workflows.

No direct conflict was found with `next-best-practices`, `vercel-react-best-practices`, `vercel-composition-patterns`, or `web-design-guidelines`. Those skills primarily govern framework and composition choices; Modern Web Guidance focuses on browser capabilities and compatibility-aware fallbacks.

## Risk Assessment

- Upstream labels the project a preview release, so its instructions and skill version can change.
- The installed skill invokes `npx modern-web-guidance@latest` when used. This keeps guidance current but does not pin execution to a reviewed release.
- Upstream states that the CLI package is self-contained with no extra runtime dependencies and that local search runs offline. Guide retrieval and initial package acquisition still require the package source described by the skill.
- The CLI collects installation counts, retrieved guide IDs, and agent-generated search queries. It does not collect raw prompts according to upstream. Set `DISABLE_TELEMETRY=1` where telemetry is not acceptable.
- The Skills CLI reported the skill as `Safe`, with zero Socket alerts and `Med Risk` from Snyk during the August 15 validation. These automated signals do not replace review because installed skills run with full agent permissions.
- The published repository uses the Apache License 2.0. The repository is a generated install target; contributions are directed to `GoogleChrome/modern-web-guidance-src`.

The default-set classification is justified by the breadth of frontend work in MyOrganizer and the skill's progressive-enhancement guidance. Re-evaluate it during periodic skill updates while the upstream release remains in preview.

## Validation

The following checks were run on August 15, 2026:

1. `npx -y skills add GoogleChrome/modern-web-guidance --skill modern-web-guidance -y` found two upstream skills, selected one, and installed only `.agents/skills/modern-web-guidance` plus `skills-lock.json`.
2. `npx -y skills add GoogleChrome/modern-web-guidance -y` found two upstream skills and installed both `modern-web-guidance` and `chrome-extensions`.
3. The installed manifest declares frontend triggers and excludes backend, CI/CD, Docker, ESLint, and Git tasks.
4. The project installation exposes one skill to Claude Code, Cursor, GitHub Copilot, and OpenCode; its Claude compatibility link resolves to the universal installation.
5. The installed corpus contains 140 guide files, and telemetry-disabled search and retrieval commands complete successfully.

## Primary Sources

Accessed August 15, 2026:

- [Modern Web Guidance README](https://github.com/GoogleChrome/modern-web-guidance/blob/main/README.md)
- [`modern-web-guidance` skill manifest](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/modern-web-guidance/SKILL.md)
- [`chrome-extensions` skill manifest](https://github.com/GoogleChrome/modern-web-guidance/blob/main/skills/chrome-extensions/SKILL.md)
- [Apache License 2.0](https://github.com/GoogleChrome/modern-web-guidance/blob/main/LICENSE)
- [Modern Web Guidance source repository](https://github.com/GoogleChrome/modern-web-guidance-src)
