export function isoToDateInput(value: string | undefined): string {
  if (!value) return '';
  // Expect ISO or date-only, return YYYY-MM-DD (UTC date portion)
  return value.slice(0, 10);
}

export function dateInputToIso(value: string | undefined): string | undefined {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return undefined;

  // Validate by parsing (new Date treats YYYY-MM-DD as UTC midnight)
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return undefined;
  // Return date-only to avoid timezone-dependent shifts when displaying
  return v.slice(0, 10);
}

/**
 * Returns today's date as a YYYY-MM-DD string in the user's local timezone.
 * Use this instead of isoToDateInput(new Date().toISOString()), which returns
 * the UTC date and may be off by one day for users in non-UTC timezones.
 */
export function todayAsDateInput(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
