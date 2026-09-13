# A named reviewer identity for the CI code review (2026-09-13)

Research date: **2026-09-13**. Frozen at that date: sources are GitHub's own documentation and GitHub's Terms of Service, read as they stood on 2026-09-13, plus live `gh api` reads of `mnaimfaizy/myorganizer`. Facts not confirmed in a primary source are marked **inferred**. Decision context: [ADR 0070](../adr/0070-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md), [ADR 0071](../adr/0071-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md), [ADR 0073](../adr/0073-a-required-check-is-a-fact-about-the-pipeline-not-a-judgment-about-the-diff.md), and the earlier [resolve-review-thread token note](2026-09-07-resolve-review-thread-token.md), which this one extends.

## Question

The CI code review posts, labels, and resolves as `github-actions[bot]` and is invoked on demand by a `/code-review` comment or the `agent-review` Request Label. Can it instead be a named reviewer that a maintainer selects in a Pull Request's **Reviewers** sidebar or invokes with an `@mention` — and is any way of doing that low-risk enough to adopt?

---

## TL;DR

- **The Reviewers sidebar accepts users and teams with write access, and Copilot.** Nothing else. A self-created GitHub App cannot be requested as a reviewer; the endpoint returns `422` for a non-collaborator, and Copilot is a documented first-party exception.
- **A machine user is the only documented route into the sidebar.** GitHub's Terms permit one free machine account per human. Selecting a collaborator fires `pull_request` with action `review_requested`, which needs no credential of the machine user's to consume.
- **A machine user that also posts, using its own token, is HIGH risk as specified and MEDIUM at best.** It needs a classic PAT, because a fine-grained PAT cannot target a repository where its owner is only a collaborator. That token is write-capable, its events re-trigger workflows, its reviews count toward mergeability, and nothing enforces its expiry on a personal account.
- **A self-created GitHub App as the posting identity reaches LOW only in a narrowed form** — Issues and Pull requests write, no Contents, labels and thread resolution left on the job token, and its scripts run from the default branch. It still cannot enter the sidebar, and it adds a standing private key the current flow does not have.
- **Decision on this date: keep the current flow.** For a public, single-maintainer repository, no option bought enough — a name on comments and an `@mention` in place of `/code-review` — to justify a new standing credential and a split identity.

---

## 1. Repository state

Read with `gh api` on 2026-09-13:

| Property               | Value                                                                   |
| ---------------------- | ----------------------------------------------------------------------- |
| Owner                  | personal account (no organisation policy applies)                       |
| Visibility             | public, forking allowed                                                 |
| `main` ruleset         | `require_code_owner_review: true`, `required_approving_review_count: 0` |
| Posting identity today | `github-actions[bot]` via the `Publish Review` job's `GITHUB_TOKEN`     |

## 2. Who can be requested as a reviewer

- [Review requests REST API](https://docs.github.com/en/rest/pulls/review-requests): reviews can be requested "from anyone with write access to the repository", returning `422 Unprocessable Entity if user is not a collaborator`.
- [Using Copilot code review](https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review): Copilot is requestable as `copilot-pull-request-reviewer[bot]`. No equivalent mechanism is documented for other Apps.
- Apps join a repository by installation, not collaboration, so a self-created App cannot meet the write-access-collaborator condition (**inferred** from the two pages above; no page states it directly).
- [Terms of Service §B.3](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service): "You may maintain no more than one free machine account in addition to your free Personal Account."
- [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows): `review_requested` is a `pull_request` activity type exposing `requested_reviewer`.

## 3. Why a machine user with its own token is not low-risk

| #   | Fact                                                                                                                                                                                                          | Source                                                                                                                                                                                                                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Fine-grained PATs cannot be used "to contribute to repositories where the user is an outside or repository collaborator", so only a classic PAT reaches this repo, and classic scopes are not per-repository. | [Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)                                                                                 |
| 2   | Collaborators on a personal-account repository have write access; there is no read-only or triage role. They can merge, submit reviews that affect mergeability, and create releases.                         | [Permission levels for a personal account repository](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository) |
| 3   | Withholding the classic `workflow` scope blocks edits to workflow files, but not a push that changes a script an existing same-repository workflow runs with secrets.                                         | [Scopes for OAuth apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps); escalation path **inferred**                                                                                            |
| 4   | Events created with a PAT trigger workflows; events created with `GITHUB_TOKEN` do not. A posted comment that quotes the `@mention` trigger would start another review.                                       | [Triggering a workflow](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)                                                                                                       |
| 5   | `resolveReviewThread` is reported to require Contents: write.                                                                                                                                                 | [2026-09-07 note](2026-09-07-resolve-review-thread-token.md)                                                                                                                                                                           |
| 6   | Maximum token lifetime policies are an organisation or enterprise feature; a personal account cannot enforce expiry.                                                                                          | [Managing personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)                                                                                 |
| 7   | GitHub recommends a GitHub App over a PAT in workflows: short-lived tokens, not tied to a user.                                                                                                               | [Secrets concepts](https://docs.github.com/en/actions/concepts/security/secrets)                                                                                                                                                       |

With every mitigation applied — classic `repo` scope only, no thread resolution under the PAT, escaping the trigger string from posted text, `COMMENT`-only reviews, never a code owner, a manually tracked expiry — the design rates MEDIUM, and remains strictly worse than `GITHUB_TOKEN`, which has no standing credential, no self-trigger surface, and no review that counts toward a merge.

## 4. Options as rated on this date

| Option                                                                | Sidebar | `@mention`               | Standing secret | Rating                              |
| --------------------------------------------------------------------- | ------- | ------------------------ | --------------- | ----------------------------------- |
| Machine user posts with its own classic PAT                           | yes     | yes, autocompleted       | classic PAT     | HIGH as specified, MEDIUM mitigated |
| Credential-less machine user as doorbell; `github-actions[bot]` posts | yes     | yes, autocompleted       | none            | LOW                                 |
| Self-created App posts, narrowed as in §5                             | no      | yes (text match)         | App private key | LOW                                 |
| Self-created App posts, with Contents: write                          | no      | yes (text match)         | App private key | MEDIUM                              |
| Current flow                                                          | no      | no (`/code-review` text) | none            | baseline — adopted                  |

A bare `@name` text trigger without owning that username was rejected outright: anyone may register the name and receive every mention.

## 5. A self-created GitHub App as the posting identity

- **Feasible and free.** An App registers under a personal account, installs on selected repositories only, and needs no webhook — [Registering a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app), [Installing your own GitHub App](https://docs.github.com/en/apps/using-github-apps/installing-your-own-github-app). `actions/create-github-app-token` (v3.2.0, released 2026-05-12) mints a one-hour installation token and revokes it at job end — [README](https://github.com/actions/create-github-app-token).
- **Not in the sidebar.** Section 2 applies unchanged.
- **Cannot be a code owner.** [About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners) names only users and teams with write access, so `require_code_owner_review` can never be met by the App.
- **A custom App is not the same risk as the job token, although both are installation tokens.** `GITHUB_TOKEN` is minted per job and is not stored anywhere; an App's private key is a standing secret that mints tokens with the App's full registered permissions, so down-scoping at mint time does not bound a leaked key. And events created by an App token trigger workflows, where `GITHUB_TOKEN` events do not — [Triggering a workflow](https://docs.github.com/en/actions/reference/workflows-and-actions/triggering-a-workflow). With Contents: write, a leaked key can push a branch whose workflows run with repository secrets.
- **The Publish job's checkout would expose the key.** On `pull_request` the job checks out the merge commit and runs `yarn review:publish` from it, so any same-repository branch — including agent branches — could edit the publish script and read a key held in that job. A deployment-branch policy on an environment does not help: `pull_request` runs carry `refs/pull/N/merge`, never `main` — [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows). With only `GITHUB_TOKEN` in the job this grants nothing a same-repository pusher lacks.
- **The narrowed form that rates LOW:** register with Issues: write and Pull requests: write only; keep label edits and `resolveReviewThread` on the job token; check out the default branch in the Publish job; keep reviews `COMMENT`-only; exclude bot-authored comments from the trigger and the concurrency group. What remains is a stored key that can post under the App's name and add the `agent-review` Request Label, which spends reviewer runs but reaches no secret.
- **Code impact found:** no workflow or script identifies the poster by login — the summary is found by its marker — and only `code-review.yml` listens to events the Publish job creates.

## 6. Unknowns

- Whether a `COMMENT`-type review clears a pending review request in the sidebar. Not stated in [Reviewing proposed changes](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/reviewing-proposed-changes-in-a-pull-request).
- Whether a self-created App's `APPROVE` counts toward required approvals. Documented only for Copilot.
