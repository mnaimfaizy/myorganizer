import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const PRE_TOOL_USE_HOOK = join(__dirname, '..', 'pre-tool-use.mjs');
export const SECRET_SCAN_HOOK = join(__dirname, '..', 'secret-scan.mjs');
export const POST_TOOL_USE_HOOK = join(__dirname, '..', 'post-tool-use.mjs');

/** Exit code the shared hook lib uses to block a tool call. */
const DENY_EXIT_CODE = 2;

export interface HookOutcome {
  status: number | null;
  decision: string;
  reason: string;
}

/**
 * Invoke a hook exactly as a harness does: JSON payload on stdin, decision on
 * stdout, block signalled by exit code 2.
 *
 * These hooks are ESM `.mjs` CLI scripts with no exports, and this Jest project
 * compiles to CommonJS — so they are exercised as subprocesses rather than
 * imported.
 */
export function runHook(hookPath: string, payload: unknown): HookOutcome {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });

  let decision = '';
  let reason = '';

  try {
    const parsed = JSON.parse(result.stdout || '{}');
    decision = parsed.permissionDecision ?? '';
    reason = parsed.permissionDecisionReason ?? '';
  } catch {
    // A hook that emits non-JSON is itself a failure; assertions below catch it.
  }

  return { status: result.status, decision, reason };
}

export function expectDenied(
  hookPath: string,
  payload: unknown,
  reasonPattern: RegExp,
): void {
  const outcome = runHook(hookPath, payload);

  expect(outcome.status).toBe(DENY_EXIT_CODE);
  expect(outcome.decision).toBe('deny');
  expect(outcome.reason).toMatch(reasonPattern);
}

export function expectAllowed(hookPath: string, payload: unknown): void {
  const outcome = runHook(hookPath, payload);

  expect(outcome.status).toBe(0);
  expect(outcome.decision).toBe('allow');
}

export function shellPayload(toolName: string, command: string) {
  return { tool_name: toolName, tool_input: { command } };
}

/**
 * PostToolUse hooks never block — they exit 0 either silently or with follow-up
 * context on stdout. `''` means the hook stayed quiet.
 */
export function runContextHook(hookPath: string, payload: unknown): string {
  const result = spawnSync(process.execPath, [hookPath], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
  });

  expect(result.status).toBe(0);

  if (!result.stdout.trim()) {
    return '';
  }

  return JSON.parse(result.stdout).additionalContext ?? '';
}

export function expectNoContext(hookPath: string, payload: unknown): void {
  expect(runContextHook(hookPath, payload)).toBe('');
}

export function expectContext(
  hookPath: string,
  payload: unknown,
  pattern: RegExp,
): void {
  expect(runContextHook(hookPath, payload)).toMatch(pattern);
}
