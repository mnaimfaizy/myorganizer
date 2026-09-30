// The appearance Device Setting as a value: its type, its default, and how a
// string read out of storage becomes one.
//
// Separate from the store so it is reachable without the store's native
// dependency. That is not tidiness — `libs/mobile/core`'s key-value storage is
// MMKV, a JSI module, so anything importing the store transitively cannot be
// tested at all, and the branch worth testing here is the one that only runs
// after a value this build no longer accepts is read back.

/** What the User asked the app to look like. `system` follows the OS. */
export type Appearance = 'system' | 'light' | 'dark';

export const DEFAULT_APPEARANCE: Appearance = 'system';

/**
 * The accepted appearance values, pinned to the type so adding one to
 * `Appearance` without teaching this table about it fails to compile rather
 * than silently reading back as the default (ADR 0053).
 */
const APPEARANCE_VALUES = {
  system: true,
  light: true,
  dark: true,
} as const satisfies Record<Appearance, true>;

/**
 * A stored appearance, or the default when the store holds nothing usable —
 * nothing written yet, or a value written by a build that accepted one this
 * one does not.
 */
export function toAppearance(raw: string | undefined): Appearance {
  return raw !== undefined &&
    Object.prototype.hasOwnProperty.call(APPEARANCE_VALUES, raw)
    ? (raw as Appearance)
    : DEFAULT_APPEARANCE;
}
