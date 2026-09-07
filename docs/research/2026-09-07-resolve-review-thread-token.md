# Resolving a review thread from CI (2026-09-07)

Research date: **2026-09-07**. Frozen at that date: sources are GitHub's own documentation, GitHub Security Lab, and first-hand reports on `github.com/orgs/community/discussions`, read as they stood on 2026-09-07. Facts not confirmed in a primary source are marked **unknown**. Decision context: [ADR 0069](../adr/0069-a-review-tier-is-a-fact-about-the-diff-and-a-gate-tier-is-a-decision-about-the-work.md), [ADR 0070](../adr/0070-a-finding-blocks-only-on-evidence-and-a-verdict-is-computed-never-written.md), issue [#685](https://github.com/mnaimfaizy/myorganizer/issues/685).

## Question

Can the GitHub Actions job token perform the GraphQL mutation `resolveReviewThread`, so that `.github/workflows/code-review.yml` closes a review thread whose finding has gone away instead of leaving a marked reply and a human click? If it cannot, what are the alternatives and what do they cost?

---

## TL;DR

- **The refusal is almost certainly a missing permission, not a token class.** `resolveReviewThread` is reported — with a GitHub staff acknowledgement — to require repository **Contents: read and write**, even though it writes no content. The workflow grants `contents: read`.
- **GitHub App installation tokens are not categorically barred from the mutation.** A reporter using a GitHub App got it working once Contents was raised to read/write. The job token _is_ an App installation token, so the same lever applies to it.
- **The "Permissions required for GitHub Apps" page for GraphQL does not exist.** `docs.github.com/en/graphql/overview/permissions-required-for-github-apps` returns 404. The REST page of that name covers REST endpoints only. GitHub's documented position is "test your app"; a request for the GraphQL list was filed and closed without one.
- **Why `minimizeComment` succeeds is not documented anywhere.** No primary source maps it to a permission. The only evidence is this repo's own runs.
- **Option 3 (a custom GitHub App) is not dead — it is redundant.** It would buy a differently-named actor, not a capability the job token lacks.
- **Recommendation: raise `contents: write` on the publish job and test it.** Only if that still fails does the fine-grained PAT become worth its cost.

---

## 1. Observed behaviour

`.github/workflows/code-review.yml` declares `contents: read`, `issues: write`, `pull-requests: write`, `actions: read`. With that token, in runs 34070935872, 34071547137, 34072101716 and 34072708289:

| Operation                                               | Outcome                                  |
| ------------------------------------------------------- | ---------------------------------------- |
| `resolveReviewThread` (GraphQL)                         | `Resource not accessible by integration` |
| `minimizeComment(classifier: OUTDATED)` (GraphQL)       | succeeds                                 |
| `POST /repos/…/pulls/…/comments` and `…/replies` (REST) | succeeds                                 |

The `tryAct` fallback in `tools/scripts/review/publish-review-report.mjs` absorbs the refusal and posts one marked reply per stale thread. Its own comment already records the diagnosis as settled — "The job token is refused the mutation" — which is the assumption this note tests.

The three operations differ in more than API surface. They also differ in the permission they are reported to need, and that is the axis nobody checked.

## 2. Is `resolveReviewThread` available to App tokens at all?

**The documented answer does not exist.** GitHub publishes [Permissions required for GitHub Apps](https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps), but it is explicitly a REST catalogue: "For each permission granted to a GitHub App, these are the REST API endpoints that the app can access via the API." There is no GraphQL counterpart — `https://docs.github.com/en/graphql/overview/permissions-required-for-github-apps` returns **404**. So the premise that a list of App-permitted mutations exists, from which `resolveReviewThread` might be absent, is false: there is no such list to be absent from.

GitHub's stated position is that you must find out empirically. From [Choosing permissions for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app): "For GraphQL requests, you should test your app to ensure that it has the required permissions for the GraphQL queries and mutations that you want to make," and "If your app makes a GraphQL API query or mutation with insufficient permissions, the API will return a `401` response." A request for the missing mapping was filed as [github/docs#33451](https://github.com/github/docs/issues/33451) — "The docs gives no information or help with finding the correct permissions required" — and is **closed** without the list being published.

The [GraphQL mutations reference](https://docs.github.com/en/graphql/reference/mutations#resolvereviewthread) documents the mutation's inputs and return type. Its content is client-rendered and could not be extracted by the tooling used here, but the schema is not the issue: **unknown** whether the entry carries any permission note, though the pattern across the reference is that it does not.

What _is_ established comes from two community reports, both first-hand, and one carrying a staff reply.

[Discussion #44650](https://github.com/orgs/community/discussions/44650) (jlao, 18–19 January 2023) hit exactly our error — "I'm trying to use the `resolveReviewThread` GraphQL mutation but I'm getting a 'Resource not accessible by integration' error back" — while authenticating as a GitHub App installation, and found that **Repository Permissions › Contents: Read and Write** was required for `resolveReviewThread` and `unresolveReviewThread`. This is a **report, not specification**: the discussion is still marked Unanswered. A second reporter (haiodo, 7 February 2024) confirmed the same requirement after accepting the new permission on a GitHub App.

[Discussion #204269](https://github.com/orgs/community/discussions/204269) (7–16 August 2026) reproduces it cleanly against a fine-grained PAT: Metadata read, Contents read, Pull requests read/write **fails** with `FORBIDDEN`; changing Contents to read/write makes the identical request **succeed**. The report notes that "resolving a review thread creates no commit, modifies no file and moves no ref," and that other pull-request writes — posting review-comment replies, editing comment bodies — work with Contents: read only. GitHub staff (hoangperry) acknowledged it as reproducible and known-shaped, and confirmed the permission mapping is overly broad. A staff acknowledgement in a discussion is stronger than a user report and weaker than documentation; treat it accordingly.

**This is the crux, and it points the opposite way from the issue's framing.** The refusal is not evidence that App installation tokens are barred from the mutation. Someone with an App installation token made it work. Our token is an App installation token with `contents: read`. The permission the mutation is reported to demand is the one permission the workflow does not grant.

**Unknown:** whether the Contents mapping still holds unchanged today, and whether it applies identically to the `github-actions[bot]` installation as to a user-installed App. Neither is documented; both are answerable in one CI run.

## 3. Why `minimizeComment` succeeds with the same token

**No primary source documents the permission for `minimizeComment`.** The [mutations reference](https://docs.github.com/en/graphql/reference/mutations#minimizecomment) describes it as minimising a comment on an Issue, Commit, Pull Request or Gist, and says nothing about permissions. It is not on the REST permissions page, because it is not REST. Given the gap established in section 2, there is nothing to cite.

What the evidence supports is narrower and sufficient: `minimizeComment` succeeds under `issues: write` + `pull-requests: write` + `contents: read`, because this repo's runs do it on every publish. The asymmetry with `resolveReviewThread` is therefore not "GraphQL mutations are closed to App tokens" — one of them plainly is not. It is that the two mutations map to different permissions, and we hold one of them.

## 4. What a fine-grained PAT would need

Repository permissions, by GitHub's own names in [Managing your personal access tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens): **Pull requests: Read and write**, plus — per discussion #204269 — **Contents: Read and write**. Metadata read is implied.

Expiry and lifetime, from the same page: an expiration must be selected; "Infinite lifetimes are allowed but may be blocked by a maximum lifetime policy set by your organization or enterprise owner." The default is 30 days, or less where the target organisation sets a token lifetime policy.

Organisation and enterprise policy can constrain or block them outright. Organisation owners "can require approval for any fine-grained personal access tokens that can access resources in the organization," and an organisation can block them entirely — such organisations "will not appear" when scoping a token. `mnaimfaizy/myorganizer` is a personal repository, so no organisation policy applies today; this becomes live only if the repository moves under an organisation.

Note the shape of what this buys: a PAT scoped to Contents read/write on this repository is a token that can rewrite the repository's files. It is granted that power solely to flip a boolean on a conversation.

## 5. What a GitHub App installation token would need

The same permissions — Pull requests read/write and Contents read/write — since the evidence in section 2 comes from App installations.

The decisive fact is documented, and it settles option 3. From [GITHUB_TOKEN](https://docs.github.com/en/actions/concepts/security/github_token): "The `GITHUB_TOKEN` secret is a GitHub App installation access token. You can use the installation access token to authenticate on behalf of the GitHub App installed on your repository." The token expires when the job finishes or at its maximum lifetime — 6 hours on GitHub-hosted runners, 24 on self-hosted — and "the token's permissions are limited to the repository that contains your workflow."

So the job token and a custom App's installation token are the _same class of credential_. If App tokens could not call the mutation, a custom App would not help. Since the evidence says they can, a custom App is not needed either: it would reach the mutation by exactly the lever the job token can reach it by, at the cost of registering an App, installing it, storing a private key, and minting a token per run.

## 6. Attribution

| Credential                    | Actor on the resolved thread and comments                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Job token (`github.token`)    | `github-actions[bot]` — the App installed on the repository, per the GITHUB_TOKEN page above. Matches what this repo's summary comments already show. |
| Fine-grained PAT              | **The human who owns the token.** Threads read as resolved by that person, not by a bot.                                                              |
| Custom App installation token | That App's `[bot]` identity.                                                                                                                          |

GitHub does not publish a page stating the actor mapping in these terms; the job-token row follows from the token being that App's installation token, and is corroborated by this repository's own comment history. The PAT row is the one that matters for review hygiene: a maintainer's name appearing on threads no human touched is a quiet corruption of the audit trail, and it is worse on a code review bot than almost anywhere else, because the whole point of the artifact is to record who judged what.

## 7. Fork pull requests and secrets

Documented plainly in [Events that trigger workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows): "With the exception of `GITHUB_TOKEN`, secrets are not passed to the runner when a workflow is triggered from a forked repository. The `GITHUB_TOKEN` has read-only permissions in pull requests from forked repositories."

GitHub Security Lab states the same in [Preventing pwn requests](https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/): "GitHub's standard `pull_request` workflow trigger by default prevents write permissions and secrets access to the target repository."

`pull_request_target` removes that protection, which is the whole hazard. The documented warning: "Running untrusted code on the `pull_request_target` trigger may lead to security vulnerabilities. These vulnerabilities include cache poisoning and granting unintended access to write privileges or secrets." Security Lab is blunter — "Combining `pull_request_target` workflow trigger with an explicit checkout of an untrusted PR is a dangerous practice that may lead to repository compromise" — and the [secure use reference](https://docs.github.com/en/actions/reference/security/secure-use) makes it a rule: "Workflows that use these triggers must not explicitly check out untrusted code."

Two consequences for this workflow. First, a repository secret is genuinely safe from a fork pull request under `pull_request` — a PAT could not be exfiltrated by an outside contributor editing the workflow file in their fork. Second, and more important: `code-review.yml` checks out `needs.context.outputs.head_sha` and runs a model over it. Under the current `pull_request` trigger that is fine. Moving it to `pull_request_target` to reach secrets on fork pull requests would be precisely the pattern all three sources name as repository compromise. That door stays shut.

---

## Options

**1. Keep the reply fallback (status quo).** Cost: one marked reply per stale thread, and one human click to resolve it. Blast radius: none — no new credential exists. The residue is that a thread stays visually open until someone clicks, and the reply itself adds noise to a conversation the bot is trying to wind down. This is a real cost but a small and bounded one, paid per stale thread rather than per run.

**2. A fine-grained PAT as a repository secret, scoped to the publish step.** Cost: a credential that expires — 30 days by default — and takes CI down silently or noisily when it does; rotation becomes someone's standing job. Blast radius: a token with Contents read/write on this repository, i.e. the ability to rewrite the codebase, living in repository secrets so that a bot can toggle a boolean. Secrets are withheld from fork pull requests, so the exposure is to anyone who can push a workflow change on a branch in this repository — a smaller set, not an empty one. And it attributes machine actions to a human. This is a large amount of power and permanent maintenance bought for a small convenience.

**3. A custom GitHub App.** Cost: App registration, installation, a private key in secrets, and per-run token minting. Blast radius: comparable Contents read/write, but scoped to an App identity with correct `[bot]` attribution and short-lived tokens — genuinely better than the PAT on both counts. The problem is what it buys. The job token _is_ an App installation token. A custom App would call the mutation through the same permission the job token can be granted directly. It is not dead; it is redundant.

**0. Raise `contents: write` on the publish job.** Not among the three the issue frames, and it should have been — issue #685's own option 4 gestures at it. Cost: one line. Blast radius: the job token gains repository write for the life of one job, capped at 6 hours, confined to this repository, and unavailable to fork pull requests. No secret to store, nothing to rotate, no attribution change, no new identity.

## Recommendation

**Take option 0 first: grant `contents: write` to the publish job and observe whether the mutation succeeds.**

The findings do not support the premise the fallback was built on. The comment in `publish-review-report.mjs` says the job token is refused the mutation, as though the token class were the obstacle; but the job token is a GitHub App installation token, an App installation token has been reported to perform this mutation, and the single permission that reporting identifies is the one the workflow withholds. The workflow was never tested with it. Four failed runs are four runs of the same untested configuration, not four pieces of evidence about token classes.

Option 3 is dead as a _capability_ argument even though it survives as an attribution argument, and that distinction is worth stating precisely: a custom App cannot unlock anything the job token cannot be granted, because they are the same kind of credential. It would only be worth building if the job token is measured to fail with Contents write and a differently-scoped App is measured to succeed — which would be a surprising result requiring its own investigation, not a plan.

Option 2 should be the last resort, not the second. It trades a bounded manual click for an unbounded standing credential: repository write power, held permanently in secrets, expiring on a schedule that will eventually break CI unattended, and stamping a maintainer's name on machine actions. The cost is not the setup; it is that it never ends.

If option 0 fails, **stay on option 1**. The status quo is honest about what happened — the bot says the finding is gone and a human closes the thread — and it costs one click. That is a fair price for not keeping a repository-write token in a secret store.

Two things gate this. Grant `contents: write` on the **publish job only**, not workflow-wide; the reviewer job must keep `contents: read`. And the evidence for the Contents requirement is a community report with a staff acknowledgement, not documentation — so this is a hypothesis to test in one run, not a fact to build on. If it fails, the note to write is the one recording that App tokens really are barred, and _that_ would be the finding that reopens options 2 and 3.

## Constraint

Whatever is chosen must respect ADR 0070 item 8: "The reviewer emits JSON only. A renderer produces the two-section Markdown for the terminal and the Pull Request, and a script — not the model — posts one summary comment edited in place and inline comments only for located `blocking` findings. **The GitHub token is never among the reviewer's tools.**"

Option 0 preserves this without effort, because it changes a permission on a step the model never runs in and introduces no credential the model could reach. Options 2 and 3 preserve it only by construction — the secret must be bound to the publish step's `env` alone and must never appear in the job-level environment the reviewer step inherits. That is one more thing to get right and keep right, and it counts against them.
