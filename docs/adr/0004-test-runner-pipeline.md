# Test Execution Pipeline: TestReviewer + TestRunner agents

Sandbox agents were silently hanging during `yarn nx test` — the Bash tool blocks until the command returns, so a slow yarn install or a hung test caused the agent to go idle, enter polling loops, and eventually die with exit code 137. Adding TestReviewer and TestRunner as explicit pipeline stages, owned by the `unit-test-delegation-workflow` skill, gives each stage a single focused job with clear contracts, a structured retry cap, and guardrails against infinite loops.

## Status

accepted

## Considered Options

**Agent-calls-next** — each agent invokes the next one in its own instructions. Rejected: distributes control flow across three definitions, making the retry logic and escalation path hard to audit or change.

**Skill-owns-chain** (chosen) — `unit-test-delegation-workflow` skill orchestrates `TestScaffold → TestReviewer → TestRunner`. Agents are stateless; they receive a contract checklist and return a verdict. Control flow, retry cap (3), and escalation live in one place.

## Pipeline contract

Each stage hands off a structured markdown checklist:

1. **TestScaffold → TestReviewer**: generated test file + behavior matrix + mock boundary map
2. **TestReviewer → TestRunner**: approved checklist with each item marked PASS/FAIL + `tsc --noEmit` / `eslint` results
3. **TestRunner → main agent**: approved checklist + actual test run results + verdict (PASS / FAIL / ESCALATE)

## Key guardrails

- **Hung test detection**: after 1 min of no stdout, TestRunner checks `ps aux` to distinguish "yarn still installing" (wait) from "test process hung" (kill, retry one-at-a-time with `--testNamePattern`)
- **Retry cap**: 3 cycles of TestReviewer-rejects-back-to-TestScaffold before escalating to main agent with a diagnosis
- **E2E never executes autonomously**: E2E test files get `tsc --noEmit` + `eslint` only; TestRunner posts a PR comment and applies `needs-e2e-review` label; enforced in both TestRunner and E2EPlanner

## Model assignments

- **TestReviewer**: Haiku — well-defined static analysis task, no judgment required
- **TestRunner**: inherits session model — needs judgment (hung vs slow, test wrong vs code broken)

## Consequences

`unit-test-delegation-workflow/SKILL.md`, `playwright-e2e-workflow/SKILL.md`, `e2e-planner.agent.md`, `CLAUDE.md`, `copilot-instructions.md`, and `checklist.md` all need updating. Seven new agent definition files must be created (`.github/agents/`, `.claude/agents/`, `.gemini/agents/`). The 22-item review checklist previously owned by the main agent moves entirely to TestReviewer.
