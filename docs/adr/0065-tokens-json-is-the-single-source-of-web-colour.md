# tokens.json is the single source of web colour

## Status

accepted

## Context

`libs/design-tokens` generated four artifacts. Two were consumed: `tokens.css`, imported by the
web application stylesheet, and `tokens.ts`, read by the landing page, the email shell, and the
Mobile App theme. Two were not: `tailwind-preset.js` and `tailwind-preset.native.js` were
generated, committed, and imported by nothing.

Both were documented as live. The library README asserted the web preset was consumed by
`apps/myorganizer/tailwind.config.js`. [ADR 0008](0008-mobile-styling-stylesheet-theme.md) asserted
the native preset fed the Mobile App theme. Neither was true — the theme reads the generated TS
constants, and neither Tailwind config had a `presets` key at all.

So web colour ran on a second, unrelated palette: a block of shadcn HSL variables hand-written in
the application stylesheet, in light and dark, plus eight sidebar variables in a different hue
family again. Editing `tokens.json` changed the landing page, the authentication pages, the email
shell, and mobile — and nothing else. The two palettes had already drifted: the caution amber was
`#B45309` in `tokens.json` and `#B35309` in the stylesheet.

The cost landed on `libs/web/pages/groceries`, which had been written against a Material Design 3
role vocabulary (`surface-container-low`, `on-surface-variant`, `outline-variant`) that existed in
neither palette. Tailwind drops unresolvable class names silently, so roughly 180 occurrences
compiled to no CSS and shipped. A further 44 resolved to the _wrong_ palette: the category picker's
selected state used a class that painted near-white, giving a selected item a fainter border than
an unselected one. Twelve Jest assertions pinned those class names as correct behaviour, so the
suite was green throughout.

Anyone reading the README would reasonably have concluded the token vocabulary worked in Tailwind
classes. That is the defect this ADR addresses; the groceries rendering was its symptom.

## Decision

`tokens.json` is the single source of truth for colour on every surface, including web Tailwind
utilities.

**The shadcn vocabulary is kept; its values are generated.** Class names do not change —
`bg-primary`, `text-muted-foreground`, `border-border` all still resolve, and both Tailwind configs
keep reading `hsl(var(--role))`. What changes is that the variables behind them are emitted from
`tokens.json` into `generated/roles.css` rather than hand-written in the application stylesheet.

**Mapping is by role, not by name.** The two palettes used `secondary` for opposite things: a
near-white neutral in the shadcn layer, an electric purple in `tokens.json`. A name-for-name
mapping would have turned every secondary button purple. The neutral slots alias neutral
primitives; the purple becomes a `brand` role of its own, alongside a `cyan` role for the one
semantic the rest of the application never expresses.

**Two tiers.** Brand Primitives and a Neutral Ramp are values; Semantic Roles are slots that alias
them, once per colour mode, using W3C Design Tokens reference syntax. The mapping lives in
`tokens.json` next to the values rather than inside the build script, because which colour is a
neutral and which is an accent is a design decision and belongs where a designer and a reviewer
will see it.

**Both colour modes are single-sourced; the toggle is not shipped.** The existing dark values are
ported rather than redesigned. Nothing in the web application applies the `dark` class, so this
changes no behaviour — it makes the dark palette maintainable and ready.

**The Neutral Ramp is never exposed as Tailwind utilities.** Dark mode cannot be expressed without
an ordered greyscale, so the ramp exists as token data. Exposing it as classes would recreate the
second elevation vocabulary that caused this.

Both orphaned presets are deleted. The web one is superseded by `roles.css`; the native one never
had a consumer.

## Consequences

- One file to edit. A colour change reaches web Tailwind utilities, the landing page, the
  authentication pages, the email shell, and the Mobile App together.
- Adding a web colour utility now has exactly one route: add a Semantic Role, with a value in both
  modes. It can no longer half-work, which is what [PR #631](https://github.com/mnaimfaizy/myorganizer/pull/631)
  had to work around by hand-copying a new role into four places.
- `tokens.json` is no longer a palette you can read at a glance. It is a palette plus a mapping,
  and it carries two colour modes.
- A visible repaint, though smaller than it sounds: the shadcn defaults were already derived from
  the same slate scale. Foreground, border, card, ring and radius values are unchanged. Muted and
  secondary move imperceptibly. Three changes are real — destructive softens from pure `#FF0000` to
  the product's `#EF4444`, the page background stops being pure white, and the dashboard sidebar
  moves from a warm-grey hue family onto the slate ramp.
- ADR 0008's consequence bullet about the native preset was inaccurate. That ADR is left as it
  stands: the decision it records — React Native `StyleSheet` over a token-derived theme — is sound
  and still in force, and a merged ADR is a record of what was decided, not a living document. This
  ADR carries the correction.
- Groceries still renders against names that resolve to nothing. Retargeting it is separate work,
  and so is the gate that would have caught this; both follow from
  [issue #632](https://github.com/mnaimfaizy/myorganizer/issues/632).

## Alternatives considered

**Let the shadcn layer keep owning its values, and retarget groceries onto it.** Lower risk and
contained to one library. Rejected: it leaves two palettes and two places to edit, so a brand
colour change still would not reach the dashboard. It treats the symptom.

**Wire the orphaned preset into both Tailwind configs.** The issue's original framing. Rejected on
two counts: it collides with the shadcn layer wherever both define a name, and the web application
is on Tailwind v4 running its JavaScript config through a legacy compatibility shim — a preset is a
v3-shaped remedy.

**Emit a v4 `@theme` block and drop the JavaScript configs entirely.** The idiomatic v4 answer, and
a cleaner end state. Rejected for now on scope: it changes how every utility is defined, not just
what it resolves to. Worth revisiting if the `@config` shim is ever removed.

**Delete the dark block rather than port it.** Briefly attractive, since nothing reaches it. Rejected
once dark mode was confirmed as roadmap work: deleting a usable starting palette only to rebuild it
later is waste, and the port is a migration rather than a design exercise.
