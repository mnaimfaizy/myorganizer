# Shared body for the Graphify refresh hooks (post-commit, post-merge).
# Background, AST-only, no network egress. See docs/graphify.md.
#
# The only thing that differs between the two hooks is how they name the set of
# files that just changed, so the caller defines graphify_changed_files() —
# printing one repo-relative path per line — and then sources this file.
#
# Every guard below exits the CALLING hook with 0. That is deliberate: a skipped
# refresh must never fail the git operation that triggered it. The whole thing is
# a no-op for anyone who has not installed graphify, so it is safe to ship to
# every contributor. Opt out at any time with GRAPHIFY_SKIP_HOOK=1.
#
# Husky runs hooks under `sh -e` (see .husky/_/h), and a bare `VAR=$(cmd)` takes
# cmd's exit status as its own — so a probe that is *expected* to fail, like
# `command -v graphify` on a machine without it, aborts the hook before its guard
# can run. Every command substitution below therefore ends in `|| true`; the
# guards that follow are what decide whether to proceed.

if [ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ]; then
  exit 0
fi

# Locate graphify. `uv tool install` drops it in ~/.local/bin, which is not
# always on PATH for hooks launched from a GUI client, so check there too.
GRAPHIFY_BIN=$(command -v graphify 2>/dev/null) || true
if [ -z "$GRAPHIFY_BIN" ] && [ -x "$HOME/.local/bin/graphify" ]; then
  GRAPHIFY_BIN="$HOME/.local/bin/graphify"
fi
if [ -z "$GRAPHIFY_BIN" ]; then
  exit 0
fi

# Only the primary checkout owns graphify-out/. Linked worktrees under
# .claude/worktrees/ share core.hooksPath, so without this guard a commit in
# any worktree writes a rogue delta-only graph and races the primary checkout.
# A linked worktree has git-dir != git-common-dir; both are resolved to
# absolute first, because git can hand back an absolute GIT_DIR alongside a
# relative ".git" common dir and a raw compare would skip the primary too.
_GFY_GITDIR=$(cd "$(git rev-parse --git-dir 2>/dev/null)" 2>/dev/null && pwd) || true
_GFY_COMMONDIR=$(cd "$(git rev-parse --git-common-dir 2>/dev/null)" 2>/dev/null && pwd) || true
if [ -n "$_GFY_COMMONDIR" ] && [ "$_GFY_GITDIR" != "$_GFY_COMMONDIR" ]; then
  exit 0
fi

# Never rebuild mid-rebase/merge/cherry-pick: the rebuild would leave unstaged
# output and block `--continue`.
GIT_DIR=${GIT_DIR:-$(git rev-parse --git-dir 2>/dev/null)} || true
for _state in "$GIT_DIR/rebase-merge" "$GIT_DIR/rebase-apply"; do
  if [ -d "$_state" ]; then
    exit 0
  fi
done
for _state in "$GIT_DIR/MERGE_HEAD" "$GIT_DIR/CHERRY_PICK_HEAD"; do
  if [ -f "$_state" ]; then
    exit 0
  fi
done

# Refresh an existing graph only. The first build needs an LLM pass for docs and
# images, so it stays manual — see the Build / refresh section of docs/graphify.md.
if [ ! -d graphify-out ]; then
  exit 0
fi

# Only when source under apps/ or libs/ changed. Doc and image changes are
# intentionally ignored here so a hook never triggers an LLM call; refresh those
# by hand.
CHANGED=$(graphify_changed_files 2>/dev/null) || true
if ! printf '%s\n' "$CHANGED" | grep -qE '^(apps|libs)/.*\.(ts|tsx|js|jsx|mjs|cjs)$'; then
  exit 0
fi

# networkx louvain iterates string-keyed sets whose order is randomised per
# process, so community ids churn between runs. Pinning this keeps the graph
# reproducible instead of drifting a few nodes on every rebuild.
export PYTHONHASHSEED=0
export GRAPHIFY_OUT=graphify-out

# Git for Windows hooks can inherit fragile pipe handles from GUI clients and
# agent shells; keep the rebuild sequential there unless told otherwise.
if [ -n "${WINDIR:-}" ] || [ -n "${MSYSTEM:-}" ]; then
  export GRAPHIFY_MAX_WORKERS="${GRAPHIFY_MAX_WORKERS:-1}"
fi

GRAPHIFY_LOG="${HOME}/.cache/graphify-rebuild.log"
mkdir -p "$(dirname "$GRAPHIFY_LOG")"

# Detached, with stdin and both streams off the hook's pipes, so the triggering
# git command returns immediately instead of waiting on a ~40s rebuild.
echo "[graphify] ${GRAPHIFY_TRIGGER:-code changed} - refreshing graph in background (log: $GRAPHIFY_LOG)"
# --backend claude-cli is pinned deliberately. Without it graphify picks
# "whichever API key is set", which with ANTHROPIC_BASE_URL exported would send
# source through an external endpoint. claude-cli keeps the rebuild local.
nohup sh -c "
  '$GRAPHIFY_BIN' extract apps --backend claude-cli &&
  '$GRAPHIFY_BIN' extract libs --backend claude-cli &&
  '$GRAPHIFY_BIN' merge-graphs apps/graphify-out/graph.json libs/graphify-out/graph.json --out graphify-out/graph.json
" >"$GRAPHIFY_LOG" 2>&1 </dev/null &

exit 0
