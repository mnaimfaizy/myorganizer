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
4. **Secrets:** `cp .sandcastle/.env.example .sandcastle/.env` and set `ANTHROPIC_API_KEY`
   (`GH_TOKEN` optional; otherwise the host's `gh` session is used).
5. The `sandcastle:myorganizer` image builds automatically on first run if missing.

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
```

**Integration is local-only** (see `docs/adr/0010`). The feature branch `feat/<slug>` is created
from `origin/main` **locally and is never pushed**. Slices run **one by one**: each branches off
the _current_ local feature head (so it sees every earlier slice's work) → the agent container
installs the slice's exact deps in-container (sharing the cache) → the agent implements and commits
locally → the host runs the **gate** (a Docker container that installs the slice's tree and runs
`nx lint` on the changed projects) → gate green → the host **fast-forwards the local feature branch**
onto the slice. No per-slice push, no per-slice PR.

GitHub is touched only to **read** the PRD/slice issues and **write** status labels + a completion
comment back to each slice.

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
