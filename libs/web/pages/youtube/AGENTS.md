# YouTube Page Agent Guide

## Scope

YouTube dashboard page library for OAuth status, subscriptions, videos, and notification settings.

## Before any UI work — read the locked prototype

The focused watching UI was decided by prototype, one locked variant per
direction. **Read the [prototype reference map](https://github.com/mnaimfaizy/myorganizer/issues/264#issuecomment-5325130655)
on PRD [#264](https://github.com/mnaimfaizy/myorganizer/issues/264) before
creating or changing any component here.** A slice issue states the lock in a
sentence; the prototype is where the actual interaction model lives.

| Direction                        | Locked variant                                    | Prototype file                                            |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------------------- |
| Channel-first (long-form home)   | **Variant C — Channel directory (list + detail)** | `channel-first/VariantC_Directory.tsx`                    |
| In-session queue rail            | **Variant B — Queue rail**                        | `queue-first/VariantB_Rail.tsx`, `useWatchQueue.ts`       |
| Shorts page + budget / hard stop | Locked timed Shorts page                          | `feed-first/ShortsPrototypePage.tsx`, `useShortsTimer.ts` |

Paths are under `libs/web/pages/youtube/src/prototype/` on the local-only
branch `prototype/youtube-channel-first`, which carries all three directions.
Read without switching branches:

```sh
git show prototype/youtube-channel-first:libs/web/pages/youtube/src/prototype/channel-first/VariantC_Directory.tsx
```

Variant letters are scoped to a direction, not global. Channel-first Variant B
(stacked carousels) was **not** selected — do not build it.

## The channel selector is a tab set

`ChannelList` renders `role="tablist"` / `role="tab"`, and the directory's detail
pane is the matching `role="tabpanel"`. The locked prototype used an `aside` with
a plain list and `aria-current`, and it has no keyboard model at all — decision
[#261](https://github.com/mnaimfaizy/myorganizer/issues/261) landed afterwards
and required arrow-key movement within the channel list with a single tab stop
for the set, which is the ARIA tabs contract. Announcing those controls as a
`nav` landmark left the behaviour and the role contradicting each other.

Do not revert it to `nav` + `aria-current` on the grounds that the prototype
looks that way; this is the "a later decision supersedes the prototype" case the
PRD warns about. Both layouts are mounted at once and hidden by CSS, so tab ids
are per-layout and the panel is named with `aria-label` rather than
`aria-labelledby`.

## Do

- Use backend YouTube APIs through the generated client.
- Treat Google OAuth tokens as backend-managed encrypted-at-rest data, separate from the E2EE vault.
- Avoid quota-expensive flows such as YouTube `search.list`.

## Do Not

- Do not expose Google client secrets, cron secrets, or tokens in frontend code.
- Do not call Google APIs directly from the browser for synced data.
