# Sandcastle dispatch — Runbook

The orchestrator (`yarn dispatch-agents` / `yarn dispatch-waves`) runs one Docker-isolated
agent per slice, one slice at a time. Each agent's dependencies are installed **inside the Linux container**
(`hooks.sandbox.onSandboxReady` → `corepack yarn install --immutable`), so native modules
(`bcrypt`, `prisma`, `@swc/core`) are always built for the container — correct on **macOS,
native Linux, and WSL2** alike. Yarn's content-addressable global cache is bind-mounted from
`.sandcastle/.yarn-cache` so installs are incremental across slices. See `docs/adr/0009`.

## The one hard requirement

**The repo (and therefore the slice worktrees under `.sandcastle/worktrees/`) must live on a
native filesystem** — ext4 on Linux/WSL2, APFS on macOS. The in-container install writes
`node_modules` to the bind-mounted worktree; on a native fs that's ~2 min, on a Windows-mounted
path (`/mnt/d`, drvfs/9P) it's ~29 min. This is the difference between a usable and an unusable
pipeline.

| Host             | Where to put the repo                            | How to run dispatch                  |
| ---------------- | ------------------------------------------------ | ------------------------------------ |
| **macOS**        | anywhere on local disk (APFS)                    | run `yarn dispatch-*` normally       |
| **native Linux** | anywhere on local disk (ext4/btrfs)              | run `yarn dispatch-*` normally       |
| **Windows**      | **inside a WSL2 distro** (`~/...`, NOT `/mnt/d`) | run from the WSL2 distro (see below) |

## Common setup (all platforms)

1. **Toolchain:** Node 22 + corepack (`corepack enable` → provides `yarn` pinned to 4.13.0).
2. **Docker:** a running Docker engine the dispatch shell can reach (`docker info` works).
3. **Auth:** `gh auth status` green and `git config user.name/.email` set, for the dispatch host.
4. **Secrets:** Prefer a 1Password Environment. The Environment CLI integration is
   currently beta and is not included in the stable Homebrew cask. Install the beta
   cask (it conflicts with the stable cask):
   ```bash
   brew uninstall --cask 1password-cli
   brew install --cask 1password-cli@beta
   op --version                         # should include -beta
   op environment --help
   ```
   Enable 1Password's desktop-app integration and copy the Environment ID from
   **Developer > View Environments**. Then run dispatch with `OP_ENVIRONMENT_ID`:
   ```bash
   export OP_ENVIRONMENT_ID=<your-1password-environment-id>
   corepack yarn dispatch-agents:1password --prd <issue-number>
   # or:
   corepack yarn dispatch-waves:1password --prd <issue-number>
   ```
   The CLI authenticates through the unlocked 1Password desktop app and injects the
   Environment variables only into the dispatch process. Do not put API keys in
   `.sandcastle/.env`. The legacy dotenv workflow remains available for local-only
   setups, but `.sandcastle/.env` is ignored and must never be committed.
5. The `sandcastle:myorganizer` image builds automatically on first run if missing. It
   already bakes in Claude Code, Cursor, and GitHub Copilot CLI so the `--agent` flag only
   switches which provider Sandcastle launches.

The dispatch host does **not** need native build tools — compilation happens in-container.

## Windows-specific setup (WSL2)

Windows-native dispatch (from PowerShell, repo on `D:\`) works but is ~29 min/install — use WSL2.

1. **Docker Desktop → Settings → Resources → WSL Integration → enable your distro (e.g. `Ubuntu`)
   → Apply & Restart.** Verify in the distro: `docker info` prints a server version.
2. Install Node 22 in the distro (userland, no sudo):
   ```bash
   curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   exec bash && nvm install 22 && nvm alias default 22 && corepack enable
   ```
3. (Recommended) stop the Windows PATH leak so the Linux `node`/`yarn` win:
   ```bash
   sudo tee /etc/wsl.conf >/dev/null <<'EOF'
   [interop]
   appendWindowsPath=false
   EOF
   ```
   then from PowerShell: `wsl --shutdown`, reopen the distro.
4. `gh auth login` (or `export GH_TOKEN=...`) inside the distro.
5. **Clone onto ext4** and run from there:
   ```bash
   git clone git@github.com:mnaimfaizy/myorganizer.git ~/projects/myorganizer
   cd ~/projects/myorganizer
   ```
   Keep your `D:\` checkout for IDE editing; the WSL2 clone is only for dispatch. The feature
   branch is built **locally** in this clone (never pushed during dispatch), so `git fetch origin`
   keeps `main` current and, when a PRD is done, you push the feature branch from here by hand.

## Running a dispatch

```bash
corepack yarn dispatch-agents --prd <issue-number>   # all ready AFK slices, one by one
corepack yarn dispatch-waves  --prd <issue-number>   # dependency-ordered across waves
corepack yarn dispatch-agents --prd <issue-number> --agent cursor
corepack yarn dispatch-agents --prd <issue-number> --agent copilot --model claude-sonnet-5
```

### Two dispatch modes

| Mode           | Invocation                                 | Base for the work branch         | Where finished work lands                   |
| -------------- | ------------------------------------------ | -------------------------------- | ------------------------------------------- |
| **PRD**        | `--prd <n>` (optionally `--issue <slice>`) | the local `feat/<slug>` head     | fast-forwarded into `feat/<slug>`           |
| **Standalone** | `--issue <n>` with **no** `--prd`          | `origin/main`, or `--base <ref>` | stays on `issue/<n>-<slug>` — nothing moves |

**One slice of a PRD:** add `--issue` to a PRD run. It still creates/reuses `feat/<slug>`,
gates, and fast-forwards — just for that one slice.

```bash
corepack yarn dispatch-agents --prd 42 --issue 45
```

**A one-off issue with no PRD** — a bug fix, a chore, anything created straight from the
`github-issue-creation-workflow` skill. Same Docker isolation, same in-container install, same
gate; only the integration step differs:

```bash
corepack yarn dispatch-agents --issue 57              # off origin/main
corepack yarn dispatch-agents --issue 57 --base feat/some-branch
```

Standalone specifics:

- **No label gate.** Naming `--issue` explicitly _is_ the authorization — `ready-for-agent` and
  `type:afk` are not required. `type:hitl`, `status:blocked`, and `status:in-progress` print a
  warning and the run proceeds, so a mistyped issue number is still visible.
- **No `## Blocked by` ordering** and no dependent unblocking — that vocabulary belongs to a PRD.
- **The branch is the deliverable.** `issue/<n>-<slug>` is left exactly as the agent committed it.
  Nothing is fast-forwarded anywhere and nothing is pushed, per `docs/adr/0010`.
- **The issue stays open** and is **not** labelled `status:done`. The orchestrator only removes
  `status:in-progress` and comments with the branch name and gate verdict — marking it done would
  claim work that exists solely on an unpushed local branch. Close it when the PR merges.
- Branch namespaces are separate (`issue/` vs `slice/`), so a standalone run and a later PRD run of
  the same issue can never collide on a branch, worktree, or gate path.

Provider switching is optional: the default agent can live in `.sandcastle/.env` as
`SANDCASTLE_AGENT=claude|cursor|copilot`. Per-provider model defaults can also live there
(`SANDCASTLE_CLAUDE_MODEL`, `SANDCASTLE_CURSOR_MODEL`, `SANDCASTLE_COPILOT_MODEL`), and
`--model` always overrides them for a single run. Claude keeps the existing complexity-based
model routing when no override is set.

After a dispatch, summarize loop and token usage:

```bash
corepack yarn agents:usage:report
corepack yarn agents:usage:report -- --prd <issue-number>
```

Model defaults are governed by `tools/config/agent-model-policy.json`; check current provider
catalogs with `corepack yarn agents:models:audit`.

With 1Password Environments, put the same variable names in the Environment instead. For
example, use `SANDCASTLE_AGENT`, `SANDCASTLE_CLAUDE_MODEL`, and the provider credential
(`CLAUDE_CODE_OAUTH_TOKEN` or `ANTHROPIC_API_KEY`, `CURSOR_API_KEY`, or `COPILOT_GITHUB_TOKEN`) as
Environment variables. 1Password Environments are currently beta functionality, and 1Password
notes that `op run --environment` may take longer to start on Apple silicon Macs.

## Claude auth: subscription vs API key

The Claude Code agent in the sandbox authenticates one of two ways. The orchestrator forwards
**exactly one** credential into the container and prints which in the run header.

| Mode           | Variable                  | Billing                                                     |
| -------------- | ------------------------- | ----------------------------------------------------------- |
| `subscription` | `CLAUDE_CODE_OAUTH_TOKEN` | Your Pro/Max plan — **the same quota as your own sessions** |
| `api`          | `ANTHROPIC_API_KEY`       | Metered per token, isolated from the plan quota             |

To use your plan instead of the API, mint a long-lived token on the **host** (not in the
container) and store it in your 1Password Environment as `CLAUDE_CODE_OAUTH_TOKEN`:

```bash
claude setup-token
```

Resolution rules:

- The OAuth token wins when both are present, and `ANTHROPIC_API_KEY` is then **not forwarded at
  all**. Which credential Claude Code prefers when it sees both is version-dependent, so leaving a
  stale API key alongside a valid token could otherwise bill the API while you believe you are on
  the plan.
- `SANDCASTLE_CLAUDE_AUTH=subscription|api` forces one mode and fails immediately if the matching
  credential is missing.
- With `--agent claude` and neither variable set, dispatch fails **before** building the sandbox
  image or any worktrees.

**Quota warning.** Subscription auth shares the 5-hour window with your interactive Claude Code
sessions, and `complexity:high` slices route to `claude-opus-5`
(`tools/config/agent-model-policy.json`). A long AFK batch can throttle you at the keyboard — send
big batches to `SANDCASTLE_CLAUDE_AUTH=api` and keep the plan for short runs.

Host credential files (`~/.claude/.credentials.json`) are deliberately **not** bind-mounted: the
container would write token refreshes back into your host credential store, and the file does not
exist at all on macOS (Keychain). `claude setup-token` is the supported headless path.

**Integration is local-only** (see `docs/adr/0010`). The feature branch `feat/<slug>` is created
from `origin/main` **locally and is never pushed**. Slices run **one by one**: each branches off
the _current_ local feature head (so it sees every earlier slice's work) → the agent container
installs the slice's exact deps in-container (sharing the cache) → the agent implements and commits
locally → the host runs the **gate** (a Docker container that installs the slice's tree and runs
`nx lint` on the changed projects) → gate green → the host **fast-forwards the local feature branch**
onto the slice. No per-slice push, no per-slice PR.

GitHub is touched only to **read** the PRD/slice issues and **write** status labels + a completion
comment back to each slice, then **close** each slice that integrates successfully (reason:
completed). The PRD issue stays open until you merge the manual PRD PR.

Standalone runs follow the same rule with the last step removed: agent → commit → gate → **stop**.
There is no integration branch to fast-forward into, so the work branch is the deliverable and the
issue is left open.

When the run finishes, **you** finish the loop by hand:

```bash
git switch feat/<slug>                 # QA the integrated branch locally
git push -u origin feat/<slug>         # publish it when you're satisfied
gh pr create --base main               # open ONE PR; CI runs here; merge it on GitHub
```

For a standalone run, substitute the `issue/<n>-<slug>` branch the summary printed.

### Tunables

| Env var              | Default | Purpose                                                            |
| -------------------- | ------- | ------------------------------------------------------------------ |
| `SLICE_GATE`         | (on)    | `off` skips the lint gate (integrates without verification).       |
| `SLICE_GATE_TARGETS` | `lint`  | Space/comma-separated Nx targets the gate runs (e.g. `lint test`). |

Slices run **serially** (one by one), so there is no concurrency knob — each slice's ~2.6GB
`node_modules` worktree exists one at a time during its run.

## Maintenance & gotchas

- **Disk:** `.sandcastle/.yarn-cache` (shared CAS cache, ~2GB) + the active slice's `node_modules`
  (~2.6GB; one at a time since slices run serially) + a transient gate worktree. Check headroom
  (`df -h .`).
- **First run is cold:** the first dispatch on a fresh checkout warms `.sandcastle/.yarn-cache`
  (downloads once); subsequent runs are incremental.
- **The feature branch is local:** `feat/<slug>` lives only in this clone until you push it by hand
  for the PRD PR. If you delete the local branch you lose the integrated work — push it first.
- **Retire the old cache:** delete `.sandcastle/node_modules_linux_cache/` if present — it's no
  longer used (the seed step and lockfile-hash invalidation were removed).
- **Never put the repo on `/mnt/d`** (or any drvfs/9P mount) for dispatch — that's the ~29 min
  trap.
