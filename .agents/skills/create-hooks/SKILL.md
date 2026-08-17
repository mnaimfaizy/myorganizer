---
name: create-hooks
description: >-
  Create and maintain multi-harness agent hooks for GitHub Copilot, Cursor
  IDE/CLI, and Claude Code. Use when adding, fixing, or reviewing hooks,
  preToolUse/postToolUse scripts, .github/hooks, .cursor/hooks.json, or
  .claude/settings.json hook blocks.
---

# Create Hooks

Add agent lifecycle hooks that work across harnesses. Prefer **one shared Node
script** under `tools/scripts/copilot-hooks/` and thin per-harness config that
points at it.

## When to Use

- User asks to add, fix, or review agent hooks
- Copilot/Cursor/Claude reports hook errors or silent no-ops
- New guardrail needed (secrets, protected paths, reminders)

## Canonical Layout

| Harness                    | Config                              | Notes                                                 |
| -------------------------- | ----------------------------------- | ----------------------------------------------------- |
| GitHub Copilot CLI / cloud | `.github/hooks/<name>.json`         | `version: 1`, camelCase events, `bash` + `powershell` |
| Cursor IDE / CLI / cloud   | `.cursor/hooks.json`                | Single file, camelCase events, `command` string only  |
| Claude Code                | `.claude/settings.json` → `hooks`   | PascalCase events, nested `matcher` + `hooks[]`       |
| Shared scripts             | `tools/scripts/copilot-hooks/*.mjs` | Always use `./lib.mjs` helpers                        |

Cursor does **not** read `.github/hooks/*.json`. Copilot cloud does **not** read
`.cursor/hooks.json`. Wire both when the behavior should apply everywhere.

Claude hooks are also loaded by Cursor when third-party configs are enabled
(Settings → Rules, Skills, Subagents). Avoid duplicate logic: prefer shared
scripts and keep Claude config as a thin launcher.

## Workflow

Copy this checklist:

```
Hook Progress:
- [ ] 1. Decide event + behavior (block vs remind)
- [ ] 2. Implement/reuse script in tools/scripts/copilot-hooks/
- [ ] 3. Wire Copilot `.github/hooks/*.json` if needed
- [ ] 4. Wire Cursor `.cursor/hooks.json` if needed
- [ ] 5. Wire Claude `.claude/settings.json` if needed
- [ ] 6. Smoke-test with piped JSON
- [ ] 7. Confirm no bare `node` + `args` arrays
```

### 1. Choose the event

| Goal                       | Prefer                                                                        |
| -------------------------- | ----------------------------------------------------------------------------- |
| Block a tool call          | `preToolUse` (all). Cursor also has `beforeShellExecution` / `beforeReadFile` |
| Remind after a change      | `postToolUse`                                                                 |
| Package install → dep-sync | `postToolUse` + shell matcher → `dep-sync-reminder.mjs`                       |

### 2. Write or extend a shared script

- Import from `./lib.mjs`: `readPayloadOrExit`, `getToolName`, `getToolInput`,
  `isMutatingTool`, `allowTool`, `denyTool`, `emitAdditionalContext`
- Never `process.exit(1)` on parse errors — use `readPayloadOrExit` (fail-open)
- Allow/skip with `allowTool()` on preToolUse scripts (required before enabling
  Cursor `failClosed`)
- Block with `denyTool(reason)` (emits dual-format JSON + exit `2`)
- Remind with `emitAdditionalContext(message)` (emits Copilot + Cursor + Claude fields)

### 3. Wire harness configs

**Copilot** (`.github/hooks/<name>.json`):

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "type": "command",
        "bash": "node tools/scripts/copilot-hooks/<script>.mjs",
        "powershell": "node tools/scripts/copilot-hooks/<script>.mjs",
        "cwd": ".",
        "timeoutSec": 5
      }
    ]
  }
}
```

**Cursor** (merge into `.cursor/hooks.json`):

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      {
        "command": "node tools/scripts/copilot-hooks/<script>.mjs",
        "matcher": "Shell|Write|Delete",
        "timeout": 5
      }
    ]
  }
}
```

Do **not** set `failClosed: true` unless every allow/skip path emits explicit
allow JSON via `allowTool()`. Empty stdout + `failClosed` blocks the tool in
Cursor (including this agent).

**Claude** (`.claude/settings.json`):

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node tools/scripts/copilot-hooks/<script>.mjs",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

### 4. Hard rules (avoid known failures)

1. **Never** use Claude-style `"command": "node", "args": [...]` — Copilot/Cursor
   treat `command` as a single shell string; bare `node` crashes on JSON stdin.
2. Always include both `bash` and `powershell` for Copilot.
3. Cursor project scripts run with cwd = repo root — use `node tools/scripts/...`.
4. Keep `timeout` / `timeoutSec` ≤ 5s unless necessary.
5. Do not duplicate the same reminder in Claude + Cursor unless the script is
   idempotent — Cursor merges Claude hooks when third-party configs are on.

### 5. Smoke-test

```powershell
'{"toolName":"bash","toolArgs":"{\"command\":\"ls\"}"}' | node tools/scripts/copilot-hooks/<script>.mjs; echo exit=$LASTEXITCODE
'{"toolName":"edit","toolArgs":"{\"path\":\"libs/app-api-client/src/index.ts\"}"}' | node tools/scripts/copilot-hooks/pre-tool-use.mjs; echo exit=$LASTEXITCODE
```

| Exit  | Meaning         |
| ----- | --------------- |
| `0`   | Allow / success |
| `2`   | Deny / block    |
| other | Failure         |

## Existing Shared Scripts

| Script                  | Role                                               |
| ----------------------- | -------------------------------------------------- |
| `pre-tool-use.mjs`      | Block edits to generated/protected paths           |
| `secret-scan.mjs`       | Block secret-looking tool input                    |
| `post-tool-use.mjs`     | Remind after OpenAPI/Prisma contract edits         |
| `dep-sync-reminder.mjs` | Remind `/dep-sync` after package manager mutations |
| `lib.mjs`               | Shared stdin parsing + dual-format output          |

## More Detail

- Harness field matrices and output schemas: [reference.md](reference.md)
