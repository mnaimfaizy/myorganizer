# A Google Cloud project is split by verification, not by environment

## Status

accepted

## Context

A development YouTube Connection went Revoked a week after it was made (issue #750): its Google
Cloud project's consent screen was in **Testing**, where Google expires refresh tokens after seven
days and caps the app at 100 test users. Every environment used one OAuth application, so production
had no way out of that mode.

The obvious fix is a separate OAuth client per environment. It does not work. The consent screen,
publishing status, app verification and YouTube Data API quota all belong to the Cloud **project**,
not the client, so separate clients in one project still share one publishing status, one
verification and one quota. `youtube.readonly` is a sensitive scope, so publishing it needs Google's
app verification: a verified domain, a public homepage, an app-wide privacy policy, a demo video,
and a review measured in weeks.

## Decision

- **Production YouTube** gets its own Cloud project. It is the only project that is ever published
  and verified.
- **Development and staging** share a second project with one OAuth client each. That project stays
  in Testing, and the weekly reconnect is accepted there.
- **Vault Cloud Backup** (`drive.appdata`, a non-sensitive scope, browser-only GIS flow) gets its
  own production project, so it never waits on YouTube's sensitive-scope review. The cost is two
  consent-screen brands to keep consistent.
- YouTube is **unavailable in production** until its project is verified. Unavailable will mean
  that an explicit backend switch is off: routes answer 404, the cron worker does nothing, and the
  web hides the feature by reading availability from the backend. The switch is separate from the
  presence of credentials, so the production client can be configured and exercised by test users
  before Users can see it.
- When the switch is on in production, the backend will refuse to start unless
  `GOOGLE_REDIRECT_URI` is `https`, not `localhost`, and on the app's own origin. This is to be
  validated at boot rather than by an ADR 0043 gate, because the values live in GitHub Environment
  secrets that no repository gate can read, and asserting them in CI would print secret-derived
  values into logs.

The switch (`YOUTUBE_AVAILABLE`) and the boot check landed in #846: `apps/backend/src/config/youtube.ts`,
`apps/backend/src/config/youtubeRedirectUri.ts`, and `apps/backend/src/middleware/youtubeAvailabilityGate.ts`.
The web side (#847) and the Cloud projects themselves (#848), tracked in PRD #844, remain open. Until
#848 lands, `YOUTUBE_AVAILABLE` must stay unset or `false` in production, so do not deploy production
YouTube credentials before then.

## Consequences

Moving an OAuth client to another project later means every User consents again, and each refresh
token issued by the old client stops working with `invalid_grant`. Production had no YouTube
Connections when this was decided, so the split needed no migration. That will not be true next
time. When it happens, the cutover marks every existing YouTube Connection Revoked in one step, in
the same deploy that switches the client, rather than letting each one fail its next Sync Run. Each
User then sees a reconnect prompt instead of a Connection that looks live and silently stops
syncing.
