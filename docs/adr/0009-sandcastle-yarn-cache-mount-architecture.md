# Sandcastle dependency handling: in-container install + shared Yarn cache (keep Yarn)

Sandbox dependency setup was the slow, fragile part of `dispatch-agents`. The orchestrator
built a Linux-native `node_modules` tree once inside Docker (`.sandcastle/node_modules_linux_cache/`,
~10-15 min), bind-mounted that single shared tree into every agent container, and ran
`yarn install --immutable` (~3 min) over Docker's Windows→Linux 9P layer. The shared mutable
tree forced `gateLock` serialization and a **gate skip whenever a slice changed `yarn.lock`**,
and the whole tree was **fully re-seeded** (~15 min again) on any lockfile change.

We will install each slice's dependencies **inside the Linux container** via a
`hooks.sandbox.onSandboxReady` hook (`corepack yarn install --immutable`) that runs before the
agent starts, with Yarn's **content-addressable global cache** bind-mounted from
`.sandcastle/.yarn-cache` (host) into every container. Installing in-container means native
binaries (`bcrypt`, `prisma`, `@swc/core`) are always built for the container's platform, so
the same code path is correct on **WSL2, native Linux, and macOS** hosts. **Yarn stays** (no
migration), and the entire seed + lockfile-hash-invalidation + `gateLock` machinery is deleted.

The one environment invariant: the worktree must live on a **native filesystem** (ext4 on
Linux/WSL2, APFS on macOS), never a Windows-mounted path (`/mnt/d`, drvfs/9P). On Windows that
means running dispatch from inside WSL2 with the repo on ext4.

## Status

accepted — validated by benchmark (below).

## Benchmark (this monorepo, warm shared Yarn cache; only the variable named changes)

| Scenario                                    | Wall-clock | Notes                                                                 |
| ------------------------------------------- | ---------- | --------------------------------------------------------------------- |
| In-container install → ext4 worktree (WSL2) | **2m 04s** | exit 0; the chosen path. ~25% over host-native                        |
| Host-native install → ext4 (reference)      | 1m 39s     | not used (host-install bakes in wrong-arch binaries on macOS/Windows) |
| In-container/host install → drvfs `/mnt/d`  | ~29m 00s   | the filesystem trap, any mode                                         |
| Old Docker seed (cold, full tree)           | ~10-15m    | replaced                                                              |

In-container on WSL2 (124s) is only ~25% slower than a host-native install (99s) and ~14×
faster than the Windows-mounted path. Because in-container is both fast enough **and** the only
option that produces correct binaries on macOS, it becomes the **single portable path** — no
host-vs-container dual mode, no platform detection.

## Considered Options & Evidence

**Host-side install + bind-mount (rejected — wrong-arch off Linux).** As used in
`mattpocock/course-video-manager`: install on the host, bind-mount `node_modules` in. Correct
and fast _only when host OS/arch matches the container_. On macOS/Windows the host produces
darwin/win32 native binaries the Linux container cannot execute. A WSL2-only variant works but
does not generalize, so it was dropped in favor of the in-container path that works everywhere.

**Dual-mode (host-install on Linux, in-container on macOS) — rejected as unnecessary.** Once the
benchmark showed in-container is only ~25% slower on WSL2, the extra ~2× install/gate code to
save 25s wasn't worth it.

**pnpm migration (deferred).** pnpm's `--store-dir` + `--virtual-store-dir` keeps the heavy tree
off slow mounts with `node_modules` as symlinks (makes the sibling `mnaimfaizy/langtutor` repo
fast). Rejected because it migrates a security-hardened, RN-containing monorepo end-to-end
(`yarn.lock`→`pnpm-lock.yaml`, re-expressing `.yarnrc.yml` gates — `enableHardenedMode`,
`npmMinimalAgeGate`, `npmPreapprovedPackages`, `checksumBehavior: throw` — as pnpm config,
rewriting every `yarn` reference, RN/Metro re-validation). Kept as the fallback if a future need
demands fast installs on a Windows-mounted path.

**Yarn + symlink `node_modules` to native overlay (rejected — disproven).** Plan: `ln -sfn
/home/agent/nm node_modules` then install. A Docker smoke-test showed **Yarn 4 refuses a
symlinked `node_modules`** — `YN0031` deletes the symlink and recreates a real directory. Yarn's
node-modules linker has no `--virtual-store-dir` equivalent, so the heavy tree cannot be
relocated off the workspace mount from inside the container.

**Native Docker named volume for the cache (rejected — infeasible for agents).** sandcastle's
`docker()` provider only accepts **host bind-mounts** and validates `existsSync(hostPath)`
(`resolveUserMounts`), so a named/anonymous volume cannot be passed to the agent containers that
`run()` launches. Hence the cache is a host **bind-mount** (`.sandcastle/.yarn-cache`).

## Consequences

- **Environment requirement:** the worktree must be on a native fs. macOS and native Linux work
  out of the box (repo on local disk). On Windows, run dispatch from WSL2 with the repo on ext4.
  Windows-native (drvfs) is supported but ~29 min/install — strongly discouraged.
- **The gate is strictly stronger.** Each gate runs in a Docker container that installs the
  slice's exact tree (sharing the cache mount) then runs `nx` — so the `yarn.lock`-change skip
  and the `gateLock` serialization are **removed**; every slice is gated, including dep-changing
  ones.
- **Cache:** `.sandcastle/.yarn-cache` (host, gitignored) is bind-mounted into every container at
  `/home/agent/.yarn-cache` (via `YARN_GLOBAL_FOLDER`). Content-addressable → never fully
  invalidated; first run warms it (cold), subsequent installs are incremental. The first dispatch
  on a fresh checkout pays a one-time cold download (bounded by `SLICE_CONCURRENCY`).
- **Code changes** (`.sandcastle/main.mts`): `hooks.sandbox.onSandboxReady: corepack yarn install
--immutable`; bind-mount `.sandcastle/.yarn-cache` + `YARN_*` env in `docker()`; deleted the
  Docker seed + `lockfileHash`/`.cache-lockfile-hash` invalidation and `gateLock`; gate rewritten
  to a single Docker `install && nx` run; added a `SLICE_CONCURRENCY` cap (default 4). `prompt.md`
  and `Dockerfile` comments updated; `.gitignore` covers `.sandcastle/.yarn-cache/` and `gate/`.
- **Host needs:** Node + corepack + `gh`/`git` + Docker on the dispatch host. It does NOT need
  native build tools (compilation happens in-container).
- **Deferred follow-up:** an explicit one-time cache pre-seed before fan-out (to avoid up to
  `SLICE_CONCURRENCY` parallel cold downloads on the very first run).
