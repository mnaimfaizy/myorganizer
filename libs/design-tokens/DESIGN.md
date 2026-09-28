# Secure Modernism

Token values live in [`src/tokens.json`](src/tokens.json). This file is brand
rationale — when to use a semantic role — not a second palette. Update it when
a role or brand rule changes, not when a hex or spacing step moves. See ADR 0023.

## Brand & Style

This design system is built on the pillars of **security, clarity, and precision**. It targets users who prioritize privacy without sacrificing the sleek efficiency of a modern SaaS workspace. The aesthetic is professional and "military-grade" yet accessible, evoking a sense of calm through organized layouts and clear boundaries.

The design style follows a **Corporate / Modern** approach with high-contrast elements. It utilizes generous white space, a disciplined grid, and a sophisticated interplay between deep, authoritative neutrals and vibrant, energetic accents. Every visual choice—from the crisp hairline borders to the specific use of teals and purples—is intended to reinforce the "vault-like" nature of the product while maintaining a fast, tech-forward user experience.

## Colors

The color palette is architected to balance trust with interactive energy.

- **Primary (#0F172A):** A deep slate navy used for high-level branding, primary text, and grounding elements. It represents the solid, unshakeable foundation of the encrypted vault.
- **Secondary (#7C3AED):** "Electric Purple" is reserved for cryptographic operations, encryption-related calls to action, and high-priority security states.
- **Tertiary (#0F766E):** "Trust Teal" signals stability and privacy, used for persistent database indicators and secure sync statuses.
- **Neutral (#F8FAFC):** A cool, sterile slate-white used for page backgrounds to keep the workspace feeling fresh and uncluttered.
- **Named Accents:**
  - **Action Cyan (#06B6D4)** is used for successful connections and active navigation nodes.
  - **Destructive (#DC2626)** is strictly used for irreversible actions like vault deletion or cache purging.
    It is a **fill**, not a text colour: at 4.8:1 against white it carries a white label on a filled
    button, and the lighter red it replaced did not.
  - **Error text and error edge** are what a failure uses, and they part in dark mode. In light
    both are Destructive (#DC2626), which reads at 4.8:1 on white. In dark the destructive pairing
    is a deep red used as a background and reads at 2.0:1 as copy, so the error message turns
    near-white and a lighter red marks only the field edge and the alert icon. The red still
    points at the problem; the words stay readable, and colour is never the only cue.
  - **Caution Amber (#B45309)** marks a state the User should notice where nothing has failed and nothing is irreversible — a change that has not reached the server yet, or a condition worth seeing before an action rather than after it. It is the deliberate middle ground the palette previously lacked: Destructive overstates these, claiming a failure or a point of no return, and the muted neutral understates them into invisibility. Reach for Caution before an action, and Destructive only for one that cannot be undone.

**A caution colour is read against a surface, so it is a pair rather than a value.** #B45309 is the light-surface value, chosen at 5.0:1 on white so it passes AA as body text; the lighter amber it replaced did not. The dark-surface pairing is a _lighter_ amber, not this hue darkened, and lives with the other themed roles in the app stylesheet because this token layer has no dark variant to hold it.

## Typography

The typography strategy uses a dual-font approach to differentiate between "Display/Brand" and "Utility/Data."

- **Plus Jakarta Sans** is the headline font. Its modern, geometric shapes project a forward-thinking tech persona. It is used for all major section headers and display titles.
- **Inter** is the workhorse font for body copy and UI labels. It was chosen for its exceptional legibility at small sizes, which is critical for viewing dense task lists and personal data.

**The named type scale.** There are seven steps and no eighth — `display`,
`title-lg`, `title`, `body`, `body-sm`, `label-caps`, `caption`. Each carries a
size, a line height, a weight, and a letter-spacing, pinned in
[`src/tokens.json`](src/tokens.json) under `type`, and each is used **whole**: a
step assembled from three tokens and a fourth value chosen at the call site is
not a scale, it is a suggestion. Plus Jakarta Sans sets `display` through
`title`; Inter sets everything from `body` down.

**Hierarchy Rules:**

- Tighter letter-spacing on headlines creates a more compact, high-end editorial
  look: `-0.02em` on `display` and `title-lg`, `-0.015em` on `title`.
- Increased letter-spacing on `label-caps` (`0.02em`) keeps uppercase metadata
  readable at 12px.
- Every other step is set at `0`.

## Layout & Spacing

The system uses a **Fluid Grid** model that prioritizes logical grouping of information.

**Breakpoints & Reflow:**

- **Mobile (<640px):** 16px margins. Grids reflow to single-column stacks. Sidebars collapse to a bottom bar or hidden drawer.
- **Tablet (640px - 1024px):** 24px margins. Two-column grid layouts for dashboard widgets.
- **Desktop (>1024px):** 12-column underlying structure with 16px gutters. Dashboard cards can span 2 or 4 columns depending on priority (e.g., "Welcome" cards span 2 columns, while "Sync Status" may span 1).

**Rhythm:**
A strict 4px baseline grid ensures vertical rhythm. Components are spaced using the `md` (16px) or `lg` (24px) units to prevent the interface from feeling crowded, reinforcing the "Organized" aspect of the brand.

## Elevation & Depth

Visual hierarchy is primarily conveyed through **Tonal Layers** and **Low-Contrast Outlines** rather than heavy shadows.

- **Surface Tiers:** The page background is the lowest tier (`#F8FAFC`). Cards and interactive containers sit one level above on pure white (`#FFFFFF`). A **raised surface** is the tier above a card — a bottom tab bar, a sheet — and exists as its own role because in dark mode the card and the page background are the same value, so "one level above" cannot be expressed by reusing either.
- **Scrim:** What a modal or sheet lays over the screen behind it — primary at 40% in light, black at 60% in dark. It is the one colour in the system carrying alpha, because a scrim that is opaque is not a scrim — it is a surface.
- **Shadow Character:** Use an ultra-diffused, low-opacity shadow for cards (`0px 1px 3px rgba(15, 23, 42, 0.05)`). This "ambient" shadow adds just enough depth to signify interactivity without breaking the clean SaaS aesthetic.
- **Borders:** Every card and input uses a 1px solid border (`#E2E8F0`). This creates a rigid, structural feel that mimics the boundaries of a physical safe or vault.

## Focus & Controls

- **Focus** is the foreground colour, drawn 2px wide with a 2px gap. A focus
  indicator that cannot be seen is not one, and the neutral ring the system
  started with sits at 2.5:1 against the page — below the 3:1 a non-text
  indicator needs. Foreground clears it in both modes and claims no meaning a
  brand colour would.
- **Control edge** is the border of something the User can operate — an input, a
  checkbox, a chip, an outlined button — and takes the muted foreground, 4.8:1 on
  white. The hairline `border` used for structure is 1.2:1, which is right for
  separating a card from the page and wrong for saying "you can type here".

## Shapes

The shape language uses **Rounded (8px)** corners to soften the professional navy and teal palette, making the app feel user-friendly and modern.

- **Standard Radius:** 0.5rem (8px) for buttons, cards, and input fields.
- **Large Radius:** 1rem (16px) for major modal containers or onboarding cards.
- **Pill Shapes:** Reserved exclusively for status indicators (e.g., "Encrypted," "Syncing") to distinguish them from actionable buttons.

## Components

### Buttons

- **Primary:** Solid `#0F172A` background with white text. 8px radius.
- **Secure Action:** Solid `#7C3AED` (Electric Purple). Used for "Unlock Vault" or "Save Passphrase."
- **Secondary:** Transparent with a **control edge** border. It is a control, so it takes the control edge rather than the structural hairline — see Focus & Controls above.

### Inputs & VaultGate

- **Inputs:** Raised surface background, **control edge** border, 8px radius. On focus, the edge thickens to 2px of **focus** (the foreground colour). In error, it thickens to 2px of **error edge** and an alert icon joins the message, so colour is not the only cue.
- **VaultGate:** When data is locked, use a semi-transparent blur overlay with a centered lock icon and a `#7C3AED` primary button to initiate the decryption flow.

### Cards

- **Style:** Pure white background, hairline `#E2E8F0` border, and subtle `0.05` opacity shadow.
- **Header:** Cards should include a header area with a `#0F172A` title (Headline-sm) and a right-aligned icon or utility menu.

### Navigation Sidebar

- **Style:** Deep navy or light slate background. Active items use a high-contrast cyan indicator (`#06B6D4`) on the left edge or a soft background tint.
- **Typography:** Navigation links use `Inter` Medium 14px for maximum space efficiency.
