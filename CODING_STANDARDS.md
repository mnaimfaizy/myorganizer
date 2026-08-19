# Coding Standards

This file is an **index**, not a second source of truth. Each entry points at the document that actually holds the rules; nothing here restates them. If you find yourself copying a rule into this file, put it in the source document instead and link to it.

It exists at the repository root under this name deliberately: agent skills look for `CODING_STANDARDS.md` when asked to identify a repo's documented standards. Before this file existed, that search was a guess, and the answer depended on what the agent happened to find.

## Where the standards live

| Source                                                                                                           | Covers                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`AGENTS.md`](AGENTS.md)                                                                                         | Repo-wide policy: architecture, commands, quality gates, branch naming, the Do / Do Not lists. Read the root file **and** the nearest nested `AGENTS.md` for the area you are touching. |
| [`CLAUDE.md`](CLAUDE.md)                                                                                         | Harness adapter — delegation rules and workflow routing for Claude Code.                                                                                                                |
| [`CONTEXT.md`](CONTEXT.md)                                                                                       | The domain glossary. Canonical terms and the words to avoid.                                                                                                                            |
| [`docs/adr/`](docs/adr/)                                                                                         | Architecture decisions, numbered sequentially from `0001`. Read the ones covering the area you are changing; a decision recorded here overrides intuition.                              |
| [`docs/ui/GUIDELINES.md`](docs/ui/GUIDELINES.md)                                                                 | UI components: composition, structure, accessibility.                                                                                                                                   |
| [`docs/testing/README.md`](docs/testing/README.md)                                                               | Test conventions across Jest and Playwright.                                                                                                                                            |
| [`libs/web-vault/AGENTS.md`](libs/web-vault/AGENTS.md), [`libs/vault-core/AGENTS.md`](libs/vault-core/AGENTS.md) | Vault ciphertext-only rules. The server stores ciphertext; plaintext is client-only.                                                                                                    |
| [`libs/design-tokens/DESIGN.md`](libs/design-tokens/DESIGN.md)                                                   | Brand rationale behind the design tokens. Values live in `tokens.json`.                                                                                                                 |

## Precedence

A documented repo standard beats a general heuristic. Where one of the documents above endorses something a general code-quality rule would flag, the document wins.

Skip anything tooling already enforces — ESLint, Prettier, and TypeScript are not review topics.
