# YouTube Focused Watching — Prototype References

Canonical map from each locked UI decision to the prototype code that defines it.

**Read this before writing or changing any YouTube UI.** The Wayfinder map
([#242](https://github.com/mnaimfaizy/myorganizer/issues/242)) locked a specific
variant per direction, and the prototype branches are the only place those
decisions exist as concrete interaction models. A PRD or slice issue summarises
the lock in a sentence; the prototype shows the actual layout, controls, states,
and decision-rich shapes behind it.

## How to read a prototype

The branches are local-only and are never pushed. Read them without switching
branches:

```bash
git show prototype/youtube-channel-first:libs/web/pages/youtube/src/prototype/channel-first/VariantC_Directory.tsx
```

`prototype/youtube-channel-first` is a superset — it carries all three
directions, so it is the single best branch to read from.

## Locked variants

| Direction                              | Locked variant                                    | Decision                                                                                                                   | Path under `libs/web/pages/youtube/src/prototype/`                   |
| -------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Channel-first — primary long-form home | **Variant C — Channel directory (list + detail)** | [#250](https://github.com/mnaimfaizy/myorganizer/issues/250)                                                               | `channel-first/VariantC_Directory.tsx`, `channel-first/shared.tsx`   |
| In-session queue rail                  | **Variant B — Queue rail**                        | [#244](https://github.com/mnaimfaizy/myorganizer/issues/244)                                                               | `queue-first/VariantB_Rail.tsx`, `queue-first/useWatchQueue.ts`      |
| Shorts page + budget / hard stop       | Locked timed Shorts page                          | [#245](https://github.com/mnaimfaizy/myorganizer/issues/245), [#251](https://github.com/mnaimfaizy/myorganizer/issues/251) | `feed-first/ShortsPrototypePage.tsx`, `feed-first/useShortsTimer.ts` |
| Feed-first                             | Variant C — Split pane                            | [#245](https://github.com/mnaimfaizy/myorganizer/issues/245)                                                               | `feed-first/VariantC_Split.tsx`                                      |

Shared player and metadata pieces used across directions live in
`feed-first/shared.tsx` (`InAppPlayer`, `MarkWatchedButton`,
`OpenOnYouTubeButton`, `VideoMeta`).

## Two traps

**Feed-first is not the home.** Variant C (split pane) is the lock _within_ the
feed-first direction, but [#247](https://github.com/mnaimfaizy/myorganizer/issues/247)
chose channel-first as the primary long-form home and ruled out a chronological
feed home entirely. Do not build a feed home from `VariantC_Split.tsx`.

**Variant letters are per direction, not global.** "Variant C" means the channel
directory in channel-first and the split pane in feed-first. Always pair the
letter with its direction. Note in particular that channel-first **Variant B**
is the stacked-carousel model that was _not_ selected — the locked Variant C is
a persistent channel list plus a detail pane.

## Rules

- Promote the prototype's decision-rich shapes — layout, cap values, control
  sets, state models, empty/loading/failure treatment, responsive behaviour.
- Do not copy the markup wholesale. Prototypes use raw Tailwind and mock data;
  production uses `@myorganizer/web-ui` primitives, real DTOs, and the generated
  API client.
- Prototype routes under `apps/myorganizer/src/app/dashboard/youtube/prototype/`
  must never ship as production UI.
- Where a prototype relies on data the production model does not carry (for
  example a video duration for a "~N min left" estimate), do not invent it — say
  so and treat it as an API-contract gap.
- Where you deliberately deviate from a lock, state the deviation and the reason
  on the slice issue rather than letting it pass silently.

## Related decisions

- [#242](https://github.com/mnaimfaizy/myorganizer/issues/242) — Wayfinder map, decision pack
- [#247](https://github.com/mnaimfaizy/myorganizer/issues/247) — browsing interaction model
- [#251](https://github.com/mnaimfaizy/myorganizer/issues/251) — Shorts timer and hard-stop semantics
- [#257](https://github.com/mnaimfaizy/myorganizer/issues/257) — domain naming
- [#261](https://github.com/mnaimfaizy/myorganizer/issues/261) — channel-first accessibility and empty/failure states
