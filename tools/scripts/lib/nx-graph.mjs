// Loads the Nx project graph for the workspace-level check scripts.
//
// Both `check-lint-coverage.mjs` and `check-typecheck.mjs` need the same thing:
// every project's name, root, and targets, in one read rather than one
// `nx show project` per project. `nx graph --file` gives that in a single call.
//
// The graph path is overridable so a checker can be exercised against a fixture
// without an Nx workspace. When we generate the graph ourselves the temp
// directory is ours to remove, on every path — hence the returned `cleanup`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Thrown when the graph cannot be produced or parsed. Callers exit 2. */
export class GraphUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GraphUnavailableError';
  }
}

/**
 * @param {string | undefined} graphArg Path to an existing graph JSON, or undefined to generate one.
 * @returns {{ nodes: Record<string, { name: string, data: { root: string, targets: Record<string, unknown> } }> }}
 */
export function loadProjectGraph(graphArg) {
  let file = graphArg;
  let cleanup = () => undefined;

  if (file) {
    if (!existsSync(file)) {
      throw new GraphUnavailableError(`${file} not found`);
    }
  } else {
    const dir = mkdtempSync(join(tmpdir(), 'nx-graph-'));
    cleanup = () => rmSync(dir, { recursive: true, force: true });
    file = join(dir, 'graph.json');
    const result = spawnSync('npx', ['nx', 'graph', '--file', file], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
    });
    if (result.status !== 0 || !existsSync(file)) {
      cleanup();
      throw new GraphUnavailableError(
        `nx graph failed: ${result.stderr?.trim() || 'no output'}`,
      );
    }
  }

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    cleanup();
    throw new GraphUnavailableError(
      `${file} is not valid JSON: ${error.message}`,
    );
  }
  cleanup();

  const nodes = parsed.graph?.nodes ?? parsed.nodes;
  if (!nodes || Object.keys(nodes).length === 0) {
    throw new GraphUnavailableError(`${file} has no project nodes`);
  }

  return { nodes };
}
