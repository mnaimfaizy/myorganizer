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
 * Issue numbers named in an issue's `## Blocked by` section.
 *
 * `- None` is an explicit empty list, not a parse failure — `to-issues` writes it
 * on every slice that has no dependencies.
 */
export function blockedBy(issue) {
  const section = issue.body?.match(
    /##\s+Blocked by\s*([\s\S]*?)(?=\n##\s|$)/i,
  )?.[1];
  if (!section || /^\s*-\s*None\s*$/im.test(section)) return [];

  return [...section.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
}

/** Issue numbers named in an issue's `## Blocks` section. */
export function blocks(issue) {
  const section = issue.body?.match(
    /##\s+Blocks\s*([\s\S]*?)(?=\n##\s|$)/i,
  )?.[1];
  if (!section || /^\s*-\s*None\b/im.test(section)) return [];

  return [...section.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
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
      const inPrdBlockers = blockedBy(issue).filter(
        (dependency) =>
          prdNumbers.has(dependency) && dependency !== issue.number,
      );
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
