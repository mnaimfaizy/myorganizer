/**
 * Decides whether Staging holds the commit being Cut, Host Applied.
 *
 * Staging Host Apply is operator-dispatched while the backend upload stays
 * automatic, so "a green apply exists" is not enough: a green run on Monday
 * says nothing about the commits uploaded on Tuesday. The Cut is allowed only
 * when Staging's latest upload is the cut commit and a green `host-apply` at
 * that commit started after it landed — with no upload of another commit in
 * between. An `apply_only` retry, or an automatic upload applied by a later
 * dispatch, both qualify. See ADR 0056, amendment 2026-09-14.
 */

export const UPLOAD_JOB = 'deploy-backend';
export const APPLY_JOB = 'host-apply';

// `deploy-staging.yml` puts the commit it checks out into `run-name`. A job's
// own `head_sha` cannot be trusted for this: on `workflow_run` it may name the
// tip of `main` when the run fired rather than the commit CI tested, which is
// why the workflow checks out `github.event.workflow_run.head_sha`.
const RUN_NAME_COMMIT = /\b([0-9a-f]{40})\b/;

/**
 * Reads one Actions API run and its jobs into the shape the guard compares.
 * A run whose name carries no commit yields `headSha: null`, which never
 * matches a cut commit — so it can refuse a Cut but never allow one.
 */
export function normalizeJobs(apiRun, apiJobs) {
  const headSha = RUN_NAME_COMMIT.exec(apiRun.display_title ?? '')?.[1] ?? null;

  return apiJobs
    .filter((job) => job.name === UPLOAD_JOB || job.name === APPLY_JOB)
    .map((job) => ({
      name: job.name,
      conclusion: job.conclusion,
      headSha,
      startedAt: job.started_at,
      completedAt: job.completed_at,
    }));
}

const short = (sha) => String(sha).slice(0, 7);
const toMillis = (iso) => Date.parse(iso);

/**
 * @param {{
 *   cutSha: string,
 *   jobs: ReturnType<typeof normalizeJobs>,
 *   runsRead: number,
 * }} input
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function evaluateStagingHostApply({ cutSha, jobs, runsRead }) {
  const green = jobs.filter((job) => job.conclusion === 'success');
  const uploads = green
    .filter((job) => job.name === UPLOAD_JOB)
    .sort((a, b) => toMillis(a.completedAt) - toMillis(b.completedAt));

  const latest = uploads.at(-1);
  if (!latest) {
    return {
      ok: false,
      reason:
        `Refusing to Cut: found no successful Staging upload (\`${UPLOAD_JOB}\`) in the latest ${runsRead} \`Deploy Staging\` runs. ` +
        `Upload and Host Apply this commit, or an older upload may simply be outside that window.`,
    };
  }

  if (latest.headSha === null) {
    return {
      ok: false,
      reason:
        `Refusing to Cut ${short(cutSha)}: Staging's latest upload came from a run that did not record which commit it uploaded. ` +
        'Dispatch `Deploy Staging` (full run, not apply_only) for this commit.',
    };
  }

  if (latest.headSha !== cutSha) {
    return {
      ok: false,
      reason:
        `Refusing to Cut ${short(cutSha)}: Staging's latest backend upload is ${short(latest.headSha)}, not the commit being cut. ` +
        'Wait for `Deploy Staging` to upload this commit, then Host Apply it.',
    };
  }

  const lastOther = uploads.findLast((job) => job.headSha !== cutSha);
  const landedAt = uploads.find(
    (job) =>
      job.headSha === cutSha &&
      (!lastOther ||
        toMillis(job.completedAt) > toMillis(lastOther.completedAt)),
  ).completedAt;

  const applied = green.some(
    (job) =>
      job.name === APPLY_JOB &&
      job.headSha === cutSha &&
      toMillis(job.startedAt) >= toMillis(landedAt),
  );

  if (!applied) {
    return {
      ok: false,
      reason:
        `Refusing to Cut ${short(cutSha)}: Staging uploaded it but it has not been Host Applied. ` +
        `Switch SSH shell access on and dispatch \`Deploy Staging\` with apply_only, then Cut once \`${APPLY_JOB}\` is green.`,
    };
  }

  return { ok: true };
}
