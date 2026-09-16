/**
 * Render an ISO timestamp in the viewer's locale and return the input unchanged
 * when it is not a parsable date.
 */
export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
