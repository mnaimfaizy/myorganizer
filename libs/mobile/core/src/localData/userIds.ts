/**
 * Reads a stored JSON array of User ids. Anything that is not one — absent,
 * malformed, or written by a version that stored something else — reads as
 * no Users rather than failing the launch it is read on.
 */
export function parseUserIds(raw: string | undefined): readonly string[] {
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string')
      : [];
  } catch {
    return [];
  }
}
