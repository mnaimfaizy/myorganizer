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
(`ANTHROPIC_API_KEY`, `CURSOR_API_KEY`, or `COPILOT_GITHUB_TOKEN`) as Environment variables.
1Password Environments are currently beta functionality, and 1Password notes that
`op run --environment` may take longer to start on Apple silicon Macs.

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

When the run finishes, **you** finish the loop by hand:

```bash
git switch feat/<slug>                 # QA the integrated branch locally
git push -u origin feat/<slug>         # publish it when you're satisfied
gh pr create --base main               # open ONE PR; CI runs here; merge it on GitHub
```

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
