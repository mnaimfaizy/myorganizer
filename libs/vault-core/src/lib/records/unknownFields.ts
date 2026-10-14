/**
 * Fields a client does not understand survive every write it makes
 * ([ADR 0114](../../../../../docs/adr/0114-a-mobile-release-ships-in-1-0-what-it-cannot-learn-later.md)
 * decision 3).
 *
 * An installed Mobile App can lag the web app by months. When the web adds a
 * field and an older client rewrites the record without it, the field is gone,
 * and the server — which stores Ciphertext only — cannot notice or put it back.
 * So a reader keeps every key it does not name, on a record and on the envelope
 * around the records, and overlays only the fields it validated.
 */

/**
 * Every key a reader understands for `T`, optional ones included. Pinning the
 * table to `T` makes a field added to the type without being added here a
 * compile error, rather than a field the reader silently passes through as
 * unknown while also rebuilding it as known.
 */
export type KnownKeys<T> = { readonly [K in keyof Required<T>]: true };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The keys of `value` that `known` does not name, with their values as stored.
 * Anything that is not a plain object has none.
 *
 * Built with `Object.fromEntries`, which defines each key as an own property:
 * a `__proto__` key that arrived in decrypted JSON stays data and never
 * becomes the result's prototype.
 */
export function unknownFieldsOf(
  value: unknown,
  known: Readonly<Record<string, true>>,
): Record<string, unknown> {
  if (!isPlainObject(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]) => !Object.prototype.hasOwnProperty.call(known, key),
    ),
  );
}

/**
 * `fields` — the reader's validated rebuild of the known fields — over the
 * unknown fields of `raw`, the stored original.
 *
 * A known field is only ever what `fields` says: one that was invalid and
 * dropped from `fields` is not brought back from `raw`.
 */
export function withUnknownFields<T extends object>(
  raw: unknown,
  known: Readonly<Record<string, true>>,
  fields: T,
): T {
  return { ...unknownFieldsOf(raw, known), ...fields };
}

/**
 * The unknown fields of two copies of one value, unioned. A key both carry
 * takes `preferred`'s value — the side a merge keeps on a tie.
 */
export function mergeUnknownFields(
  preferred: unknown,
  other: unknown,
  known: Readonly<Record<string, true>>,
): Record<string, unknown> {
  return {
    ...unknownFieldsOf(other, known),
    ...unknownFieldsOf(preferred, known),
  };
}
