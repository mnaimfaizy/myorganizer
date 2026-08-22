# A resumed slice is told what the previous run actually did

## Status

accepted. Amends [0035](0035-interrupted-slices-resume-from-git-and-destruction-is-deliberate.md).

## Context

[ADR 0035](0035-interrupted-slices-resume-from-git-and-destruction-is-deliberate.md) established that a slice branch which exists and is ahead of its base is resumable, and that resumability is a fact about git and nothing else. That is still right. What it did not anticipate is that **two very different runs leave git in the identical state.**

`decideSliceDisposition` reads three facts: does the branch exist, is it ahead of base, does `merge-base` still match. Those three are the same whether the agent was killed mid-thought by a quota wall or finished cleanly, committed through the `Commit` sub-agent, and lost to a red host gate. Both produce a branch with commits on it. Both resume.

But the brief a resumed agent receives is written for only one of them. Guardrails 5 and 6 are unconditional statements of fact:

> Files present in the checkpoint do NOT satisfy a Gated Pipeline…
>
> **Nothing in the checkpoint has passed a deterministic check.** It was committed with `--no-verify` while the run was being killed, so lint, tsc and the test suite have never once seen it.

Slice #447 proved what that costs. Its first run executed ComponentBuilder ×3, ComponentReviewer ×4, StorybookCurator ×2, TestScaffold ×2, TestReviewer ×2, TestRunner ×2, `/code-review` ×2, `CodeExplorer`, and committed `b6a0e84` through the `Commit` sub-agent with husky green — nineteen sub-agent invocations in all. The gate then failed on an orchestrator bug (`nx show projects --affected` invoked without `--json`), so the slice did not integrate. On the next dispatch the agent was handed the interrupted-run brief, believed it, and reported back:

> None of the three mandated Gated Pipelines have run… Zero deterministic checks have touched these files (committed with `--no-verify`)… `/code-review` skill has not run

Every clause false. It then set out to redo all nineteen hops. A quota window spent reproducing work that was already done and already reviewed.

The information that would have prevented this is not in git, and that is the crux. Git records which **files** a run produced. Nothing records which **pipelines** ran, whether `/code-review` passed, or why the run ended. ADR 0035 rejected "inlining the checkpoint diff or the previous log into the resume prompt" on the grounds that it spends context on "material the agent can read from git in one command" — sound for a diff, and sound for a tool-call transcript. It does not reach pipeline-execution history, because that material is in no command the agent can run.

A partial record does exist. `--trace-subagents` writes `logs/subagents/<n>/index.md`, which named all nineteen invocations. It is opt-in, so it is absent on most runs, and it was never read back on resume regardless.

## Decision

**A resume brief states what is known, not what is assumed.** A resumed agent is told which of the two situations it is in, and what the previous run reported doing.

**The two prior-run kinds are distinguished by the checkpoint tag.** Only the crash path tags a Slice Checkpoint (`wip/<n>-checkpoint`). A branch head carrying that tag is an interrupted run; a branch head without it is a run that committed normally and lost to the gate. Guardrails 5 and 6 apply to the first and are replaced for the second, where the correct instruction is inverted: confirm the work, fix what the gate reported, do not re-run pipelines already accounted for. `decideSliceDisposition` is untouched — both kinds still resume. Only the brief changes.

**Runs report their own progress incrementally, through `HANDOFF:` markers in the slice log.** The agent prints one line as each hop lands; the orchestrator appends its own verdict — above all the gate result — to the same stream. On resume, marker lines from the previous run segment are extracted and rendered into the brief.

Three properties are load-bearing:

- **Incremental, never summarised at the end.** A quota kill lands mid-thought. A summary written just before the completion promise is missing from exactly the run that needed it. Markers written as work lands survive whatever stops the run.
- **The slice log is the carrier.** It always exists. `logs/subagents/<n>/index.md` does not, and a channel that is absent by default cannot be the source of truth. The trace remains useful corroboration for a human.
- **Only marker lines travel.** Feeding a raw log tail forward would drag a dead agent's mid-thought reasoning into the next brief where it reads as instruction. Markers are a bounded, greppable, capped subset.

**A handoff is evidence, not authority.** It is the previous run's own claim about itself. The brief says so, and directs the agent to confirm a claim cheaply — the commit exists, the file is in the tree — and then review rather than re-run. Guardrail 5's substance survives: "the file exists" is still not "the pipeline ran". What changes is that "the pipeline ran" is now a question with an available answer instead of an assumption resolved in the most expensive direction.

**An absent handoff means unknown, never "nothing ran".** No markers renders no section, and the guardrails fall back to the conservative interrupted-run wording.

## Considered Options

**Reading `logs/subagents/<n>/index.md` as the handoff source** was rejected. It is the richest record — verified agent names, models, turn counts, tool calls — but `--trace-subagents` is opt-in, so pointing a brief at it yields a file that is simply not there on a default run. A resume path that works only under a diagnostic flag is worse than no resume path, because its absence is silent.

**A single end-of-run summary block before `<promise>COMPLETE</promise>`** was rejected as the primary mechanism. It is cheap and it reads well, but it only exists when the run completed — the case least in need of it. Retained as a consolidated final marker; the incremental lines are what the design rests on.

**Feeding the previous run's raw log tail forward** was rejected. `tailLines` already exists and the plumbing would have been trivial, but fifteen lines of a killed agent's stream-of-thought is unstructured text that an LLM reads as directive. Filtering to a marker prefix costs nothing and removes the injection surface entirely.

**Recording pipeline state in a sidecar JSON file** was rejected. It is a second source of truth that can disagree with the log, needs its own lifecycle and cleanup, and re-imports the "tracker vs git" split ADR 0035 deliberately closed. The log is already written, already per-slice, already read on the failure path.

**A `status:gate-failed` label to distinguish the two kinds** was rejected for the reason ADR 0035 rejected `status:interrupted`: the branch is local and unpushed, so a shared tracker asserting its state lies to any second reader. The tag is local, which is exactly the right scope for a local fact.

**Trusting the handoff and skipping re-verification** was rejected. The handoff is self-reported by an agent that may have been wrong or may have been killed between doing a thing and reporting it. Trust it enough to stop re-running blind; never enough to skip confirming.

## Consequences

- A gate-failure retry no longer re-runs pipelines it already passed. That is the cost this ADR exists to remove.
- The prompt grows by a short handoff-marker instruction, and a resumed brief by up to 40 marker lines. Both are far below the cost of one redundant pipeline hop.
- Markers are self-reported, so an agent that dies before printing one leaves that step invisible and it gets re-run. The failure mode is wasted work, never skipped work — the same direction ADR 0035 chose.
- Operator output changes too: the orchestrator now prints `resuming from completed run whose gate failed` where it used to print `resuming from checkpoint` for both. The old message misreported to the human in the same way the brief misreported to the agent.
- `RESUME_GUARDRAILS` remains exported as the interrupted-run set, so existing callers and tests are unaffected. New callers use `resumeGuardrails(kind)`.
- This ADR does not revisit ADR 0035's rejection of inlining diffs or transcripts. That rejection stands; it simply never covered execution history, which no git command reports.
