# The web app is hosted on the same site as its API, and Staging deploys daily from cPanel

## Status

accepted

## Context

On Staging a User was asked to sign in again every time the web app was closed and reopened, in a browser tab and in the Installed Web App (#1138). Production was not affected.

The Session survives a restart only if the browser sends the Refresh Token cookie to the API. That cookie is `SameSite=Lax` and carries no `Domain` attribute, so a browser sends it only from a page on the same site as the API. Production's web app and API are subdomains of one domain. Staging's web app was on a `vercel.app` address and its API on a subdomain of the operator's domain: two sites, so every refresh failed with `401`. A `vercel.app` address is on the Public Suffix List and is never the same site as anything else.

Nothing recorded that the two had to share a site, and nothing checked it. Staging broke the rule on the day its web app was put on Vercel, and the session code was correct for the topology it assumed.

Two facts about the host constrain any fix. SSH shell access is a manual toggle that reverts ([ADR 0056](0056-ci-owns-host-apply-without-describing-the-jail.md), amendment of 2026-09-14), so nothing automatic may need a shell. And a cPanel web bundle is not live when it is uploaded: it ships without `node_modules`, and the running process keeps serving the previous build until it restarts.

## Decision

- **The web app and its API are hosted on the same site on every environment.** The Session depends on it. This is a rule about hosting, not about the cookie.
- **Staging's web app is hosted on cPanel beside its API**, on a subdomain of the same domain. Staging is no longer a different kind of host from Production. Vercel is removed from the repository. The Staging web address is a `staging` environment setting; the public tree names no host (ADR 0056).
- **Staging deploys once a day, and on a manual dispatch.** It no longer deploys on every green `main`. A scheduled run uploads the backend bundle and deploys the web app from the newest `main` commit whose CI is green. It skips when Staging already serves that commit, and it never rolls Staging back: when the web app or the backend holds a newer commit that a dispatch put there, the schedule leaves it alone. When that commit is already uploaded but the web app is not serving it, the run fails without uploading again, so a nameless upload never replaces one a dispatch made. When the Staging web address does not answer, the run fails without uploading: no answer is not evidence that Staging is empty.
- **Host Apply is unchanged**: operator-dispatched and backend-only on both environments. A dispatched run uploads the backend, applies it, and deploys the web app at the same commit.
- **The Staging web bundle goes live without a shell.** The run uploads `tmp/restart.txt` last, which makes the host restart the app. A restart is enough while the bundle's dependency list matches what is installed; when it differs, the run uploads, does not restart, and fails saying that "Run NPM Install" and "Restart" are owed.
- **A probe decides whether the run is green.** It waits until the running process answers with the build just uploaded. A file served from disk does not count: on this host anything under `public/` is served by the web server, not by the process.
- **The same-site rule is asserted where it can be**: the Staging web job compares the parent domains of the web address and the API address and fails when they differ. The comparison takes the last two labels of each hostname, which is a rule of thumb.
- **Production's deploy flow does not change.** It relies on the written rule.

## Considered Options

- **A custom domain on the Vercel project** — rejected. It restores the Session but leaves Staging on a different kind of host from Production, which is how the difference went unseen.
- **The web app joins Host Apply** — rejected. Host Apply is operator-dispatched, so the web app could never deploy without a person.
- **Routing the API through the web address with a rewrite** — rejected. It changes how every request travels in order to repair a hosting mismatch.
- **`SameSite=None; Secure` on the cookie** — rejected. Safari blocks cross-site cookies regardless, so iOS, the platform the Installed Web App exists for ([ADR 0127](0127-a-mobile-release-is-an-android-download-and-ios-is-the-installed-web-app.md)), would stay broken.
- **The web app receives the Refresh Token in the response body**, as the Mobile App does ([ADR 0006](0006-mobile-refresh-token-delivery.md)) — rejected. It puts a long-lived token where an injected script can read it.
- **Shipping `node_modules` in the bundle** — rejected. The host's Node.js selector manages that folder itself.
- **Uploading automatically and going live by hand**, as Production does — rejected for Staging. It would usually run an older build than the one uploaded.
- **Deploying on every green `main`** — rejected by the operator. Staging is tested rarely and deliberately, and a daily run that fails is a signal that gets read.
- **A runtime same-site check in the backend** — rejected. It puts hosting logic in the auth path, and the API does not reliably know its own public address.

## Consequences

- **A scheduled upload cannot be Cut without a full dispatch.** The Cut guard reads the uploaded commit from the run's name, and a scheduled run's name carries none, because the commit it deploys is chosen inside the run. The guard refuses such an upload, so an `apply_only` dispatch after a scheduled run no longer satisfies it; a full dispatch does. This narrows the amendment of 2026-09-14 to ADR 0056, and it fails closed. The guard decides as before; one refusal message was reworded.
- A scheduled run takes its steps from the tip of `main` and its code from the commit it chose, which may be older. The deploy script therefore runs from the tip, and a chosen commit that cannot produce a commit-named build is skipped.
- Staging can be up to a day behind `main`. A change that needs testing sooner is deployed by dispatch.
- The first Staging deploy after a dependency change is red until someone installs and restarts in cPanel. The next run sees the running build match the uploaded one and treats those dependencies as installed. That is an inference: the host cannot be asked what is installed, so a build that starts on an older patch version of a dependency reads as installed.
- Between an upload that owes an install and the install, the new bundle is on disk under the old process. If the host restarts the app by itself in that window, the new build starts on the old dependencies. No option without a shell avoids this; the run is red for as long as it lasts.
- The probe, the skip and the install decision all read a page the running process renders. That holds while the root layout is rendered on every request; a test pins it.
- Response headers set by the web framework do not reach files the host serves from disk, and on this host the bundle's `public/` folder is the document root. The service worker's `Cache-Control` and `Content-Security-Policy` are therefore also set by a block an operator appends once to the host's own configuration file in that folder. The repository never ships that file, because the host keeps its own there and an upload would replace it; a test refuses one in the tree. The Staging probe compares the two headers with their expected values. Production serves the same way and has no probe.
- [ADR 0028](0028-production-deploys-are-approval-gated-and-tags-are-receipts.md) and ADR 0056 each said Staging deploys on every green `main`; both carry a dated amendment.
- Vocabulary: [`CONTEXT.md`](../../CONTEXT.md) § Release & Deploy. **Host Apply** stays backend-only; the web restart is not Host Apply.
