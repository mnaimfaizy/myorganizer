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
  - **Destructive (#EF4444)** is strictly used for irreversible actions like vault deletion or cache purging.

## Typography

The typography strategy uses a dual-font approach to differentiate between "Display/Brand" and "Utility/Data."

- **Plus Jakarta Sans** is the headline font. Its modern, geometric shapes project a forward-thinking tech persona. It is used for all major section headers and display titles.
- **Inter** is the workhorse font for body copy and UI labels. It was chosen for its exceptional legibility at small sizes, which is critical for viewing dense task lists and personal data.

**Hierarchy Rules:**

- Tighter letter-spacing on headlines (`-0.015em` to `-0.02em`) creates a more compact, high-end editorial look.
- Increased letter-spacing on `label-caps` (`0.02em`) ensures metadata remains readable even at 12px.

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

- **Surface Tiers:** The page background is the lowest tier (`#F8FAFC`). Cards and interactive containers sit one level above on pure white (`#FFFFFF`).
- **Shadow Character:** Use an ultra-diffused, low-opacity shadow for cards (`0px 1px 3px rgba(15, 23, 42, 0.05)`). This "ambient" shadow adds just enough depth to signify interactivity without breaking the clean SaaS aesthetic.
- **Borders:** Every card and input uses a 1px solid border (`#E2E8F0`). This creates a rigid, structural feel that mimics the boundaries of a physical safe or vault.

## Shapes

The shape language uses **Rounded (8px)** corners to soften the professional navy and teal palette, making the app feel user-friendly and modern.

- **Standard Radius:** 0.5rem (8px) for buttons, cards, and input fields.
- **Large Radius:** 1rem (16px) for major modal containers or onboarding cards.
- **Pill Shapes:** Reserved exclusively for status indicators (e.g., "Encrypted," "Syncing") to distinguish them from actionable buttons.

## Components

### Buttons

- **Primary:** Solid `#0F172A` background with white text. 8px radius.
- **Secure Action:** Solid `#7C3AED` (Electric Purple). Used for "Unlock Vault" or "Save Passphrase."
- **Secondary:** Transparent with a `#E2E8F0` border.

### Inputs & VaultGate

- **Inputs:** White background, `#E2E8F0` border, 8px radius. On focus, use a 2px ring of `#94A3B8`.
- **VaultGate:** When data is locked, use a semi-transparent blur overlay with a centered lock icon and a `#7C3AED` primary button to initiate the decryption flow.

### Cards

- **Style:** Pure white background, hairline `#E2E8F0` border, and subtle `0.05` opacity shadow.
- **Header:** Cards should include a header area with a `#0F172A` title (Headline-sm) and a right-aligned icon or utility menu.

### Navigation Sidebar

- **Style:** Deep navy or light slate background. Active items use a high-contrast cyan indicator (`#06B6D4`) on the left edge or a soft background tint.
- **Typography:** Navigation links use `Inter` Medium 14px for maximum space efficiency.
