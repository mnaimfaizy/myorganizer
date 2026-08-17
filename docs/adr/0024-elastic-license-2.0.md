# Elastic License 2.0 for the source

The repository declared MIT in `package.json` and the README but never shipped a `LICENSE` file, so no MIT grant was made. MIT would allow commercial redistribution of this codebase. We license the **source** under Elastic License 2.0 instead: self-hosting and internal use (including professional Tasks) are allowed; providing the software to third parties as a hosted or managed service, or selling it as a product, is not.

## Status

accepted

## Decision

- The source is licensed under [Elastic License 2.0](https://www.elastic.co/licensing/elastic-license) (SPDX `Elastic-2.0`). Copyright line: `Copyright 2024–2026 Mohammad Naim Faizy`.
- Prior MIT badges and `"license": "MIT"` were incorrect. They were not a grant. Relicensing does not grandfather historical snapshots under MIT.
- `LICENSE` governs clone, modify, self-host, and redistribute. Terms for a hosted MyOrganizer account are a separate document, not this file.
- GitHub inbound=outbound: contributions are offered under ELv2. No CLA until outside contributors make assignment necessary.
- Vendored third-party files keep their own licenses. A root `NOTICE` lists React/ReactDOM (MIT), Caprasimo and Figtree (OFL-1.1), and notes that `tools/assets/dc-runtime/support.js` is generated design-tool output with no separate license grant.

## Considered Options

- **MIT** — rejected. It permits selling and SaaS of this code, which is the opposite of the intent.
- **Honor the MIT badges for existing commits** — rejected. That would leave the current tree commercially reusable forever; ELv2 would only constrain later work.
- **PolyForm Noncommercial** — rejected. It forbids using the software in a business context, including a User tracking professional Tasks on a self-hosted copy.
- **PolyForm Internal Use** — rejected. It does not grant redistribution, which fights a public GitHub repo and pull requests.
- **Apache 2.0 + Commons Clause** — rejected. Closer on “no selling,” but GitHub/SPDX treat it as non-standard and the clause is widely disliked.
- **A custom LICENSE** — rejected. It can match the intent exactly, but every reader then needs legal review, and GitHub will show “Other.”

ELv2 does not forbid charging for a copy of the source. That edge is accepted: the threat is a competing hosted product, not a paid zip of a public repository.

## Consequences

- Adding MIT back to the badge, footer, or `package.json` is a license change, not a docs fix.
- The copyright holder can still operate a hosted service or offer a separate commercial grant; ELv2 restricts licensees, not the owner.
- Implementation of this ADR is `LICENSE`, `NOTICE`, and aligning the README, `package.json`, backend README, and generated OpenAPI license field (issue [#320](https://github.com/mnaimfaizy/myorganizer/issues/320)).
