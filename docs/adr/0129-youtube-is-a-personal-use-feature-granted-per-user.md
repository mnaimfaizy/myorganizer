# YouTube is a personal-use feature granted per User, not a verified public one

## Status

accepted

## Context

[ADR 0091](./0091-a-google-cloud-project-is-split-by-verification-not-by-environment.md) made production YouTube wait on Google's sensitive-scope verification of its own Cloud project. That review was in progress in October 2026 and asked for a rewritten privacy policy, a second demo video, and reviewer credentials. A verified public app also answers to YouTube's audits afterwards.

MyOrganiser has one operator, no revenue, and a public repository. Research into the exposure (kept out of the tree, as working notes) found that being non-commercial removes most privacy-law obligations but none of the YouTube API Services terms, and that the exposure that remains scales with who the feature is offered to, not with a Google publishing setting.

Google lists "personal use" apps, for the developer and fewer than 100 users, as not needing verification. Such a project is published "In production" and left unverified: each person clicks through an unverified-app warning once, and the project may be consented to by 100 accounts over its lifetime, a count that is never reset.

## Decision

- **YouTube is offered only to people the operator personally knows.** It is not advertised on the landing page and there is no way to request it in the app.
- **The production Cloud project stays In production and unverified**, as a personal-use app. The verification request is withdrawn. Testing status was rejected: Google expires every authorization seven days after consent there, which breaks background sync weekly, and describes that status as for development.
- **YouTube Access is a per-User grant made by a Platform Admin** in the admin console and written to the Admin Audit Log. Without it the YouTube routes answer 404 and the web shows nothing, the same behaviour the global `YOUTUBE_AVAILABLE` switch already produces. That switch stays, above the grant, as the way to turn the feature off for everyone. A redeemable invitation link was rejected: Google no longer checks who connects on an unverified project, so a forwarded link would admit a stranger and spend a lifetime slot.
- **Grants are capped by configuration at 25 Users ever granted.** The count is of Users ever granted, not currently granted, because that is what Google counts. It approximates Google's number, so the ceiling leaves headroom.
- **A YouTube Disconnect is immediate and complete**, whether the User disconnects or a Platform Admin withdraws YouTube Access: the grant is revoked at Google and every Followed Channel, Cached Upload, Watched mark and digest setting is deleted in the same step. This reverses the retention half of [ADR 0092](./0092-youtube-disconnect-preserves-watched-by-default.md); its refusal to disconnect while a Sync Run is live stands. YouTube's Developer Policies give seven days to delete after a revocation, and thirty days of Watched retention exceeded that.
- **A YouTube Connection left Revoked for seven days ends in a YouTube Disconnect.** Deleting at once was rejected because a password change at Google produces the same signal as a deliberate removal.
- **Before a first connect the User accepts a one-time acknowledgement**, stored with its time: what is read and stored, that it sits outside the Vault, the unverified-app warning, the deletion rule, and agreement to the privacy policy and to YouTube's Terms of Service.
- **The legal pages keep a YouTube section** stating that the feature is available only to accounts the operator has enabled, that MyOrganiser uses YouTube API Services, how to revoke at Google, and linking the Google Privacy Policy and YouTube's Terms of Service.
- **The "Open on YouTube" link moves outside the embedded player**, which nothing may overlay.

## Consequences

Two deviations from YouTube's developer guidance are accepted rather than fixed. No Made for Kids status is read for a video: the rule guards against tracking viewers of children's content, and MyOrganiser has no analytics or advertising and plays video only in YouTube's own player. Shorts are still classified by runtime, because the Data API returns no Shorts flag and the Shorts Daily Budget depends on the split.

The 100-account limit is permanent for the project. Exhausting it leaves two exits: verification, or a new project, which marks every existing YouTube Connection Revoked as ADR 0091 describes.

Development and staging are unchanged: they share a Testing project and reconnect weekly.

Opening YouTube to the public later means resuming verification and revisiting every decision above, starting with the privacy-law position that a small known audience currently supports.
