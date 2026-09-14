/**
 * The decision behind `nx:targets:check` (`tools/scripts/check-nx-declared-targets.mjs`):
 * a ratchet holding Declared Targets on `@nx/*` executors to a fixed baseline,
 * so the count can only shrink toward Nx's Inferred Targets (ADR 0082).
 *
 * A target is in scope only when its `project.json` entry names an executor
 * in the `@nx/` namespace. Three shapes are deliberately out of scope and
 * never appear in `classifyDeclaredTargets`'s output:
 *   - `nx:run-commands` targets, which are not Nx-plugin executors at all.
 *   - Third-party executors (`@driimus/nx-plugin-openapi:...`), which carry
 *     no Inferred Target migration path in Nx's own plugin set.
 *   - An override that declares `dependsOn` or `options` with no `executor`
 *     key — that shape configures the Inferred Target rather than replacing
 *     it, since Nx merges the two by target name; it is not a Declared Target.
 *
 * A baseline entry is keyed by project name, target name, and executor
 * together (`keyOf`), so a target that keeps its name but changes executor
 * reads as one baseline entry going stale and one new entry appearing, never
 * as a silent substitution.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const BASELINE_PATH = join(
  'tools',
  'config',
  'nx-declared-targets-baseline.json',
);
export const SCHEMA_VERSION = 1;
export const NX_EXECUTOR_PREFIX = '@nx/';

/** The composite key a baseline entry and a classified target are compared by. */
export const keyOf = (entry) =>
  `${entry.project}::${entry.target}::${entry.executor}`;

/**
 * Reads and validates the baseline file. Throws on any error — the caller
 * decides the exit code and message.
 */
export function readBaseline({
  cwd = process.cwd(),
  path = BASELINE_PATH,
} = {}) {
  const absolute = join(cwd, path);
  if (!existsSync(absolute)) {
    throw new Error(`${path} not found — the baseline is a required artifact`);
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absolute, 'utf8'));
  } catch (error) {
    throw new Error(`${path} is not valid JSON: ${error.message}`);
  }
  if (parsed?.schemaVersion !== SCHEMA_VERSION) {
    throw new Error(
      `${path}: expected "schemaVersion": ${SCHEMA_VERSION}, found ${JSON.stringify(parsed?.schemaVersion)}`,
    );
  }
  if (!Array.isArray(parsed?.baseline)) {
    throw new Error(`${path}: expected a "baseline" array`);
  }

  const seen = new Set();
  const entries = [];
  parsed.baseline.forEach((entry, index) => {
    const at = `${path}[${index}]`;
    const project =
      typeof entry?.project === 'string' ? entry.project.trim() : '';
    const target = typeof entry?.target === 'string' ? entry.target.trim() : '';
    const executor =
      typeof entry?.executor === 'string' ? entry.executor.trim() : '';
    if (!project || !target || !executor) {
      throw new Error(
        `${at}: entry requires non-empty "project", "target", and "executor"`,
      );
    }
    if (!executor.startsWith(NX_EXECUTOR_PREFIX)) {
      throw new Error(
        `${at}: executor "${executor}" is not in the ${NX_EXECUTOR_PREFIX} namespace`,
      );
    }
    const key = keyOf({ project, target, executor });
    if (seen.has(key)) {
      throw new Error(
        `${at}: ${project} \`${target}\` (${executor}) is duplicated in the baseline`,
      );
    }
    seen.add(key);
    entries.push({ project, target, executor });
  });
  return entries;
}

/**
 * Every Declared Target on an `@nx/*` executor across the given projects.
 * `projects` is `{ name, path, targets }[]`, `targets` being the raw
 * `project.json` `targets` object.
 */
export function classifyDeclaredTargets(projects) {
  const entries = [];
  for (const project of projects) {
    const targets = project.targets ?? {};
    for (const [target, config] of Object.entries(targets)) {
      const executor =
        typeof config?.executor === 'string' ? config.executor : undefined;
      if (!executor || !executor.startsWith(NX_EXECUTOR_PREFIX)) continue;
      entries.push({
        project: project.name,
        target,
        executor,
        path: project.path,
      });
    }
  }
  return entries.sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
}

/**
 * Compares the baseline against the classified targets. `missing` is a
 * classified target absent from the baseline — a new `@nx/*` Declared Target.
 * `stale` is a baseline entry with no matching classified target — the
 * baseline claiming a target that is no longer there. The baseline can only
 * shrink: an entry can leave it, but nothing here ever grows it silently.
 */
export function compareBaseline(baseline, actual) {
  const baselineKeys = new Set(baseline.map(keyOf));
  const actualKeys = new Set(actual.map(keyOf));
  const missing = actual.filter((entry) => !baselineKeys.has(keyOf(entry)));
  const stale = baseline.filter((entry) => !actualKeys.has(keyOf(entry)));
  return { missing, stale };
}
