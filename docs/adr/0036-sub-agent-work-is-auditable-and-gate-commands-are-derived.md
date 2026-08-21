# Sub-agent work is auditable, and gate commands are derived rather than tabulated

## Status

accepted

## Context

Slice #397 integrated with a green gate while two of its checks had never actually run.

`TestReviewer` returned PASS twice against red project targets. It gates on a hand-maintained table in `.github/agents/test-reviewer.agent.md` mapping each project to a `tsconfig` path and a lint command. `libs/email-shell` is a new library and is absent from that table, so the reviewer guessed: it typechecked `tsconfig.lib.json`, which excludes spec files, and ran `yarn nx lint email-shell`, a target that does not exist for this library — its real target is `email-shell:eslint:lint`. A `tsc` TS1501 and six `import/first` errors were hidden. Falling back to a bare `npx eslint <files>` resolved the root config instead of the project's, which is where `import/first` is enforced.

The table carries a safety net: if a `tsconfig.*` path does not exist, record `tsc: NOT RUN` rather than guessing. It only catches a _missing_ path. Here the path existed and was merely the wrong one, so the net never fired and the reviewer reported PASS in good faith. Every library added to this repository re-arms the same trap.

None of this was visible while it happened. A sandcastle run produces exactly one artifact: a flat text log — 3,314 lines for #397 — in which a sub-agent's tool calls appear inline and typographically identical to the orchestrator's. `Agent(TestReviewer gate on email tests)` is a single line with no marker for where that sub-agent's work ends. The wrong `tsc` invocation sits at line 2452 and reads exactly like every other command. The failure was findable only by reading the whole file afterwards, and only because the agent itself reported it.

The structured session that would carry attribution is never persisted. `.sandcastle/` holds logs, worktrees, and a usage file; no session JSONL is captured to the host, though sandcastle exposes the API for it.

## Decision

**Gate commands are derived from the workspace, never tabulated.** `TestReviewer` and any sibling that runs project checks resolves the real targets from Nx and the project's own tsconfig, rather than reading a checked-in map. A project the reviewer cannot resolve is a `NOT RUN` with a stated reason — never a guess at a plausible path. A hand-maintained table is a cache of workspace facts with no invalidation, and its staleness is silent and fails open.

**Sub-agent work becomes auditable behind an opt-in flag.** `--trace-subagents` writes per-sub-agent transcripts under `.sandcastle/logs/subagents/<slice>/`, carrying that sub-agent's tool calls, context length, and token usage. Without the flag, output is byte-for-byte what it is today: one flat log per slice.

**Attribution comes from the captured session, not from parsing the stream.** Sandcastle `0.12.0` adds `onAgentStreamEvent`, which tees typed events (`text`, `toolCall` with name and args, `raw`) in real time — but every variant carries only `iteration` and `timestamp`, and **nothing identifies which agent emitted it**. Boundaries inferred from the stream are guesses, and a guessed boundary produces an audit file that silently includes the orchestrator's next commands or omits the sub-agent's last. The Claude session JSONL carries real attribution (`isSidechain`, `parentUuid`) plus per-message usage, so the opt-in path persists and derives from that.

This depends on API that does not exist in the pinned `0.7.0`, so **upgrading sandcastle is a hard prerequisite and is sequenced as separate work**.

**The reviewer fix lands before the logging.** They address different problems: the table is a live, repeating failure that will misfire again the moment another library is added, while the logging is what makes the _next_, unknown failure findable. Fixing the known failure first is worth more than observing it better.

## Considered Options

**Reconstructing attribution by parsing the text log** was rejected. Nothing in the stream marks where a sub-agent's work ends, so boundaries are heuristic and nesting is ambiguous — and it cannot produce context length or per-sub-agent token counts at all, because those numbers are not in the text. It would yield split files that look correct and whose figures are absent or wrong, which is worse than no files.

**Teeing `onAgentStreamEvent` alone** was rejected for the same reason in better clothing. The events are typed and real-time, which makes them a good source, but the absence of an emitting-agent field means boundaries remain inferred. It answers "what commands ran" and not "which agent ran them", and the question this ADR exists to answer is the second one.

**Splitting logs on by default** was rejected. Not for size — 348 KB covers three slices, and an extra structured file per run would roughly double a negligible number. The cost is that the flat log is what a human actually opens when a run fails, and a second always-present artifact invites "which one do I read?" on every failure. The real pile is file count: 18 sub-agent invocations on a single slice means hundreds of small files across a PRD run.

The counter-argument is genuine and was weighed: a flag cannot be enabled retroactively for a run that has already failed, so the first occurrence of any new silent failure will still go unobserved. Accepted deliberately, because the reviewer fix removes the known instance and the default stays legible.

**Bundling the sandcastle upgrade with the logging work** was rejected. Five minor versions of a pre-1.0 package will break something; discovering that while also debugging new logging code makes both harder to diagnose. Every option currently relied on still exists in `0.12.0` — `maxIterations`, `idleTimeoutSeconds`, `completionSignal`, `resumeSession`, `forkSession`, `branchStrategy`, `preservedWorktreePath`, `dangerouslySkipPermissions` — so the upgrade is expected to be survivable, but it is validated against a known-good baseline rather than a moving one.

## Consequences

Deriving gate commands makes `TestReviewer` slower per run — it must query the workspace instead of reading a constant — and couples it to Nx's project-graph output. That is the correct coupling: the graph is the truth the table was approximating.

`NOT RUN` will appear more often and more honestly. A reviewer that admits it could not resolve a project is more useful than one that guesses, but it also means a PASS may now arrive with a check explicitly skipped. Readers must treat `NOT RUN` as a finding, not as noise.

The audit path is only as good as what the session JSONL records. Whether sub-agent turns land in the same file as sidechain records is **unverified** — every host session inspected carries the `isSidechain` field with zero true values, because none used sub-agents. The first implementation step is a spike to confirm it; if sub-agent turns are written elsewhere, the design changes and this ADR needs revisiting.

Two adjacent defects surfaced in the same investigation and are recorded here so they are not rediscovered:

- The token line printed after every run reads as a run total but is the **final assistant message's snapshot** — sandcastle documents `IterationUsage` as exactly that. `inputTokens` is `2` in every record ever written. Sub-agent usage is not counted at all. Persisting the session makes real totals derivable.
- Nx cannot open its SQLite workspace database inside the container, because worktree detection resolves the cache to a main-worktree root that does not exist there. It falls back to `.nx/cache-local` and `.nx/workspace-data-local`, which is why `git add -A` swept 155k lines of cache into a slice commit. `.gitignore` now globs those, but the cause is unset `NX_CACHE_DIRECTORY` and `NX_WORKSPACE_DATA_DIRECTORY` in the sandbox environment.
