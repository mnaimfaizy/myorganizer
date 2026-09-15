/**
 * Pure decision logic for which of a PRD's issues enter a dispatch run.
 *
 * Kept out of `.sandcastle/main.mts` so the choice can be tested without GitHub,
 * Docker, or a real PRD. The orchestrator stays orchestration; the judgement about
 * what is dispatchable is decided here from explicit inputs.
 *
 * Run the tests with: yarn sandcastle:slice-selection:test
 *
 * ## Why this module exists
 *
 * PRD #461 dispatched exactly one of its three slices and then reported the PRD
 * green. The run selected its slices once, up front, excluding anything labelled
 * `status:blocked` — and at that moment slices two and three were both blocked on
 * slice one. It ran slice one, removed `status:blocked` from slice two (the
 * orchestrator maintains that label itself), and never looked at it again, because
 * the selection had already been made.
 *
 * The dispatch loop was never the problem: it drains its pending set through
 * `## Blocked by` ordering and refuses a slice whose dependencies are unfinished.
 * The problem is that `status:blocked` was used as an *entry* filter, so the run
 * refused to consider the very slices it was about to unblock.
 *
 * ## The rule
 *
 * `status:blocked` is admissible evidence only when nothing better is available.
 * When a slice's `## Blocked by` section names another slice of the same PRD, the
 * label is a cache of a fact this run can evaluate directly and keep current —
 * so the slice is admitted and `## Blocked by` ordering owns it.
 *
 * When the label is *not* explained by an in-PRD blocker, it means something this
 * code cannot reason about: an external dependency, or a human parking the slice.
 * That slice stays out. A stale label must not strand a slice; an unexplained one
 * must not be overridden.
 *
 * Nothing here loosens ordering. A slice admitted under this rule still cannot run
 * before its blockers complete — that is `nextReadySlice`'s job, and a slice whose
 * blockers never complete is reported as blocked at the end of the run rather than
 * silently dropped.
 */

/** A slice is finished if it is closed or carries `status:done`. */
export function isCompleted(issue) {
  return (
    issue.state === 'CLOSED' ||
    (issue.labels ?? []).some((label) => label.name === 'status:done')
  );
}

const hasLabel = (issue, name) =>
  (issue.labels ?? []).some((label) => label.name === name);

/**
 * The body of a `## <heading>` section, up to the next `## ` heading.
 */
function sectionBody(issue, heading) {
  return issue.body?.match(
    new RegExp(`##\\s+${heading}\\s*([\\s\\S]*?)(?=\\n##\\s|$)`, 'i'),
  )?.[1];
}

// `-`, `*`, `+`, or `1.` bullet; optional task box; `#N` or `[#N](url)`.
const LEADING_LIST_REF =
  /^[ \t]*(?:[-*+]|\d+\.)[ \t]+(?:\[[ xX]\][ \t]+)?\[?#(\d+)\b/gm;

/**
 * Issue numbers that lead a list item in a section, first mention wins.
 *
 * Only the reference a list item *starts with* is a dependency edge:
 * `- #773 — the ADR this rule implements`, `* #773`, `- [#773](url)`, or a task
 * item `- [ ] #773`. Everything else in the section is explanation, and PRD #772
 * stalled on reading it as edges: slice #774 carried the note "**not** blocked by
 * #771 … #787 is the slice that needs it", so a negation became a blocker and a
 * genuine `#787 → #774` edge became a two-slice cycle. `- None — does not wait on
 * #272` is the same trap, which is why `- None` needs no special case here — it
 * leads with no reference, so it yields an empty list like any other prose.
 */
function leadingListRefs(section) {
  if (!section) return [];
  const refs = [...section.matchAll(LEADING_LIST_REF)].map((match) =>
    Number(match[1]),
  );
  return [...new Set(refs)];
}

/**
 * Issue numbers an issue's `## Blocked by` section lists as dependencies.
 *
 * `- None` is an explicit empty list, not a parse failure — `to-issues` writes it
 * on every slice that has no dependencies.
 */
export function blockedBy(issue) {
  return leadingListRefs(sectionBody(issue, 'Blocked by'));
}

/** Issue numbers an issue's `## Blocks` section lists as dependents. */
export function blocks(issue) {
  return leadingListRefs(sectionBody(issue, 'Blocks'));
}

/** The `## Blocked by` entries of `issue` that are in `numbers`, excluding itself. */
function blockersWithin(issue, numbers) {
  return blockedBy(issue).filter(
    (dependency) => numbers.has(dependency) && dependency !== issue.number,
  );
}

/**
 * Whether one dependency no longer holds anything back.
 *
 * A dependency is satisfied when this run completed it, or when the issue itself
 * is complete — closed or `status:done` — whether or not it belongs to the PRD.
 * PRD #772's #787 named #771, a standalone bug that had already merged and closed;
 * counting only this PRD's slices as completable left that edge unsatisfiable
 * forever. An issue `lookup` cannot find is unsatisfied: an unknown dependency is
 * not evidence that the work is done.
 */
export function isDependencySatisfied(
  dependency,
  { completed = new Set(), lookup = () => undefined } = {},
) {
  if (completed.has(dependency)) return true;
  const issue = lookup(dependency);
  return issue !== undefined && isCompleted(issue);
}

/** The `## Blocked by` entries of `issue` that still hold it back. */
export function unfinishedDependencies(issue, options) {
  return blockedBy(issue).filter(
    (dependency) =>
      dependency !== issue.number &&
      !isDependencySatisfied(dependency, options),
  );
}

/**
 * Dependency cycles among `issues`, each written as a closed path that starts and
 * ends at its lowest issue number — `[774, 787, 774]`.
 *
 * Only edges between the given issues count, so a cycle is something this set can
 * never drain by itself. Each cycle is reported once regardless of where the walk
 * entered it. A slice naming itself is ignored here, as it is everywhere else.
 */
export function findDependencyCycles(issues) {
  const numbers = new Set(issues.map((issue) => issue.number));
  const edges = new Map(
    issues.map((issue) => [issue.number, blockersWithin(issue, numbers)]),
  );

  const cycles = new Map();
  const finished = new Set();
  const path = [];
  const onPath = new Set();

  const visit = (node) => {
    path.push(node);
    onPath.add(node);
    for (const next of edges.get(node) ?? []) {
      if (onPath.has(next)) {
        const loop = path.slice(path.indexOf(next));
        const start = loop.indexOf(Math.min(...loop));
        const rotated = [...loop.slice(start), ...loop.slice(0, start)];
        const key = rotated.join(',');
        if (!cycles.has(key)) cycles.set(key, [...rotated, rotated[0]]);
      } else if (!finished.has(next)) {
        visit(next);
      }
    }
    path.pop();
    onPath.delete(node);
    finished.add(node);
  };

  for (const number of [...numbers].sort((a, b) => a - b)) {
    if (!finished.has(number)) visit(number);
  }
  return [...cycles.values()];
}

/** `[774, 787, 774]` → `#774 → #787 → #774`. */
export function formatCycle(cycle) {
  return cycle.map((number) => `#${number}`).join(' → ');
}

/**
 * Why each slice left pending at the end of a run did not run.
 *
 * A slice on a cycle is told so, because "blocked by unfinished slice(s)" reads as
 * work someone forgot to do when it is really a contradiction in the issue bodies
 * that no amount of waiting resolves. A slice merely downstream of a cycle keeps
 * the unfinished-dependency reason; its blocker's own line explains the cycle.
 */
export function describeBlockedSlices(pending, options) {
  const cycles = findDependencyCycles(pending);
  return pending.map((issue) => {
    const cycle = cycles.find((path) => path.includes(issue.number));
    if (cycle) {
      return { issue, reason: `dependency cycle: ${formatCycle(cycle)}` };
    }
    const unfinished = unfinishedDependencies(issue, options);
    return {
      issue,
      reason: `blocked by unfinished slice(s): ${unfinished
        .map((dependency) => `#${dependency}`)
        .join(', ')}`,
    };
  });
}

/** Every issue carrying this PRD's back-reference, complete or not. */
export function slicesOfPrd(issues, prd) {
  return issues.filter((issue) => issue.body?.includes(`PRD: #${prd}`));
}

/**
 * Chooses the slices a PRD run dispatches.
 *
 * Returns `{ selected, admitted, deferred }`:
 *
 * - `selected` — open, ready AFK slices of this PRD that are not already complete,
 *   in issue-number order. The caller's dispatch loop orders these by
 *   `## Blocked by`; selection deliberately does not.
 * - `admitted` — the subset of `selected` that carries `status:blocked` and was
 *   admitted anyway because an in-PRD blocker explains the label. Surfaced so a
 *   run can say out loud that it is taking slices the label calls blocked.
 * - `deferred` — slices held out because `status:blocked` is not explained by any
 *   in-PRD blocker, each with the reason. Surfaced so they are visibly skipped
 *   rather than silently absent.
 *
 * `only` restricts the run to a single slice number (`--issue` against a PRD).
 * It narrows the result and never widens it: a slice the rule defers stays
 * deferred even when named explicitly, because the label means something this
 * code cannot evaluate.
 */
export function selectPrdSlices(issues, { prd, only } = {}) {
  const ofPrd = slicesOfPrd(issues, prd);
  const prdNumbers = new Set(ofPrd.map((issue) => issue.number));

  const selected = [];
  const admitted = [];
  const deferred = [];

  for (const issue of ofPrd) {
    if (only !== undefined && issue.number !== only) continue;
    if (issue.state !== 'OPEN') continue;
    if (!hasLabel(issue, 'ready-for-agent')) continue;
    if (!hasLabel(issue, 'type:afk')) continue;
    if (isCompleted(issue)) continue;

    if (hasLabel(issue, 'status:blocked')) {
      const inPrdBlockers = blockersWithin(issue, prdNumbers);
      if (inPrdBlockers.length === 0) {
        deferred.push({
          issue,
          reason:
            'labelled status:blocked with no in-PRD blocker in `## Blocked by` — ' +
            'the label means something this run cannot evaluate',
        });
        continue;
      }
      admitted.push(issue);
    }

    selected.push(issue);
  }

  const byNumber = (left, right) => left.number - right.number;
  return {
    selected: selected.sort(byNumber),
    admitted: admitted.sort(byNumber),
    deferred: deferred.sort((a, b) => a.issue.number - b.issue.number),
  };
}

/**
 * One line describing how much of a PRD a run actually assembled.
 *
 * The run that dispatched one of three slices still printed "the PRD is green",
 * which is true about the branch and misleading about the PRD. A gate verdict has
 * to carry its own scope, so the reader does not supply the wrong one.
 */
export function describeAssembly(issues, prd) {
  const ofPrd = slicesOfPrd(issues, prd);
  const total = ofPrd.length;
  const done = ofPrd.filter(isCompleted).length;
  return {
    total,
    done,
    complete: total > 0 && done === total,
    summary:
      total === 0 ? 'no slices found' : `${done}/${total} slice(s) assembled`,
  };
}
