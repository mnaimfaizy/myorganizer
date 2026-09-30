# An approved design is committed to the repo, and work builds to the committed copy

## Status

accepted

Extends [ADR 0041](0041-internal-notes-have-homes.md) with one more home: approved designs live in `docs/design/`.

## Context

Mobile App v1 ([PRD #908](https://github.com/mnaimfaizy/myorganizer/issues/908)) was designed in a Claude Design canvas: 142 artboards covering every page, state, and platform difference, approved before any code was written. Its ten slices were then built by Sandcastle agents, and the app they produced scored between 3 and 6 out of 10 against the canvas when it was audited. [The investigation](../research/2026-09-30-mobile-v1-agents-built-without-the-approved-design.md) traced most of that drift to one fact: **no agent ever saw the design.**

- Every slice issue carried the design as one line — "Design approved: the `3 · Tasks` page of the [Mobile v1 canvas](https://claude.ai/artifact/NQEpyQyfkqKrTEBHmm3ehj) (version 14). Build to it." The link is a private claude.ai artifact. A sandboxed agent has no claude.ai login, so the link opens nothing.
- What the issue text did transcribe was a handful of numbers. Copy, layout, empty states, press states, and platform differences existed only in the canvas, and the agents invented them.
- Eight of the ten agents never mentioned the canvas at all. The one that noticed it could not open it wrote "check these against the sheet" in its first iteration; its second iteration, starting cold, wrote "matches the approved sheet exactly".

A design that lives only behind a link is available to exactly the people who can open that link, at the version it happens to show today. It cannot be reviewed in a pull request, pinned to the commit that built it, or read by any agent the maintainer does not personally sign in.

## Decision

1. **An approved design is committed under `docs/design/<design>/`**, in the change that approves it and before any issue is dispatched against it. The folder holds the design tool's export as the tool produced it — for a Claude Design canvas, one HTML file per artboard under `artboards/` and the canvas's own index, `canvas.json` — and a `README.md` naming the source link, the exported version and date, what it is approved for, and an index of every artboard by page and section. [`docs/design/README.md`](../design/README.md) lists every design.
2. **The committed copy is the design of record.** A PRD, an issue, or a pull request that builds to a design links **both** the committed folder — and, for a slice, the artboards it covers by path — **and** the design tool's link. The folder is what gets built to and reviewed against; the link is where the next version is worked on.
3. **A change to an approved design is re-exported and committed in its own commit**, so the history of the folder is the history of what was approved, and every commit that built to the design can be read against the version it saw.
4. **An export is kept byte for byte.** It is not a House Explainer Page ([ADR 0046](0046-house-explainer-pages-have-a-designer-and-a-gate.md)) and is never rewritten to become one: `docs/design/` is excluded from the page hygiene gate as a directory, from Prettier, and is marked `linguist-generated` so a pull request collapses it.
5. **Where an issue's text and the committed design disagree, the issue is corrected before dispatch** — by whoever writes the slices ([`to-issues`](../../.agents/skills/to-issues/SKILL.md)) — rather than left for the builder to pick one. The Mobile v1 slices said "tap or swipe right = done" while the canvas had the checkbox tick and the row open the Task; the agent built the text, faithfully, and it was wrong.

## Considered Options

**Keep the link and transcribe the design into the issue text** is what Mobile v1 did. Transcription is lossy by construction — it carries what the writer thought to copy, and the drift was precisely in what they did not — and it forks the design into a second copy that disagrees with the first the moment either changes.

**Commit screenshots instead of the export** was rejected as the record. A PNG shows the design but does not state it: a builder cannot read a radius, a colour, or a string out of one, and two versions cannot be diffed. The HTML export carries every value inline and still renders in a browser. Screenshots may be added beside it later; they do not replace it.

**Keep designs somewhere other than the repo** — a shared drive, the design tool itself, a separate repository — leaves every one of the problems above: the sandbox still cannot reach it, a pull request still cannot show it, and nothing pins which version a commit built to.

**List each export in the page hygiene gate's LEGACY table** was rejected. The table exists so that each unconventional page is a decision someone recorded; a hundred-odd artboards per design, with the same reason each time, would be a list kept only to satisfy the check.

## Consequences

- An agent in the sandbox can read the design: it is in the tree it is working in. Whether it does, and what it reports when it cannot, is [ADR 0111](0111-a-prd-slice-closes-only-on-a-clean-outcome.md).
- The repository grows by the size of each export — about 3 MB for Mobile v1 — and by each re-export. Accepted: it is text, it compresses, and it is the artefact the code is judged against.
- The export's HTML references files it does not ship (the canvas runtime and web fonts), so a file opened in a browser renders layout and colour but not the canvas chrome. The values are in the markup either way.
- A design approved before this decision has no committed copy until someone exports it. Mobile v1 is the first; it was exported at version `1790728996-b9c1`, after PR #944 had rebuilt the app to it.
