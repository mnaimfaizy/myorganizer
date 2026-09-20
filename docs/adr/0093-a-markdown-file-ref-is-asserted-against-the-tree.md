# A Markdown file-ref is asserted against the tree; frozen history is exempted by name

PR [#743](https://github.com/mnaimfaizy/myorganizer/pull/743) copied the name `migrationRunner`
from issue #290 into an addendum on [ADR 0014](0014-component-pipeline-guardrails.md). No such
module exists; the file is `libs/web-vault-ui/src/lib/reconcileRunner.tsx`.
`yarn docs:commands:check` does not read inline backticks, so nothing failed until code review
([#744](https://github.com/mnaimfaizy/myorganizer/issues/744)).

## Status

proposed

## Decision

A backticked token in tracked Markdown that is a **file-ref** — a high-confidence claim that a
path, filename, or directory-scoped module exists in this repository — is an Assertion Gate
subject. `yarn docs:file-refs:check` compares those claims to the tree and names the ones that
do not resolve.

The gate never asks whether a document was touched. That option was considered and rejected:
[ADR 0043](0043-gates-assert-facts.md) forbids a gate that fails on the shape of a diff, and a
check that only looks at names the current patch introduced would be exactly that shape. Husky
and CI would then disagree about the same tree.

The gate does not exclude `docs/adr/` as a class. The defect that bought this rule lived in a
live addendum on an accepted ADR; a blanket ADR skip would have let it through. What it does
exclude as a class is `docs/research/`, because [ADR 0041](0041-internal-notes-have-homes.md)
already freezes every Research Brief at the date in its filename — those documents are
_supposed_ to name files that have since moved.

Every other tracked `*.md` file is in scope, including accepted ADRs. A claim that is recorded
history rather than a current pointer — a superseded path an ADR must keep because merged ADRs
are not rewritten ([ADR 0042](0042-adr-numbers-are-claims-until-merged.md)) — carries a written
reason in `tools/config/doc-file-refs-exemptions.json`. A stale entry fails: the documenting
file is gone, the claim is no longer made, or the named file exists again.

## Detection (narrow on purpose)

A checker that treated every backticked identifier as a file would fail on type names, CLI
flags, JSON keys, and glossary terms, and would then be turned off. The shapes that fail are
only these:

1. **Repo-relative paths.** A backticked token that starts under a known top-level directory
   (`apps/`, `libs/`, `docs/`, `tools/`, `.github/`, and the other roots `docs:commands:check`
   already uses), has no spaces or ellipsis, and is not a negative existence claim ("this app
   has no `proxy.ts`", "do not introduce `package-lock.json`"). A trailing `:line` citation is
   stripped and the file is checked. `libs/web-vault-ui/src/lib/reconcileRunner.tsx` is a
   file-ref; `src/index.ts` in an example is not.
2. **Directory-scoped module identifiers.** A camelCase or PascalCase identifier in the same
   sentence as a backticked directory that ends with a slash under `libs/` or `apps/` is a
   claim that `{dir}/{name}.ts` (or `.tsx` / `.mjs` / `.js`) exists. That is the #743 sentence
   (shown here in a fence so this ADR does not itself claim the missing module):

   ```text
   every .tsx under libs/web-vault-ui/src/lib/, so session, vaultGate and migrationRunner
   ```

   `migrationRunner` is camelCase and the directory is written with a trailing slash, so the
   missing module fails. All-lowercase `session` is not this shape. Identifiers in a different
   sentence, or next to a directory written without a trailing slash, are not file-refs.

A backticked basename with an extension and no path is **not** a file-ref in this version.
Too many of those are lockfiles, "do not add" examples, or generic names; widen that shape
only after a real miss that a path or directory-scoped identifier would not have caught.

Fenced code blocks are out of scope here. Shell fences already belong to `docs:commands:check`;
other fences are examples, not claims that the tokens exist as repo files. Placeholders,
globs, and gitignored build outputs are skipped for the same reasons that checker skips them.

Widen a shape only after a real miss. Do not start from "every backticked word."

## Considered Options

- **Check only names the diff introduced** — rejected. It is a coupling gate (ADR 0043). It
  also needs a base ref, so the hook and CI would not be looking at the same fact.
- **Check only "current" documents and skip `docs/adr/` and `docs/research/`** — rejected as
  stated. Skipping research is right (ADR 0041). Skipping every ADR would have missed #743.
- **Check everything, including research, with exemptions only** — rejected. Research Briefs
  are frozen as a class; listing every historical path in them would turn the exemptions file
  into a shadow copy of `docs/research/` and punish leaving those briefs alone.

## Consequences

- A live document that names a module which does not exist fails before code review.
- A merged ADR may keep a renamed path if that path is exempted with a reason. Removing the
  sentence, restoring the file, or deleting the ADR makes the exemption stale.
- Prose that is not a file-ref stays review-only. ADR 0043's concession about unassertable
  narrative is unchanged; this gate covers the assertable subset ADR 0085 already asked
  artifacts not to state without asserting.
