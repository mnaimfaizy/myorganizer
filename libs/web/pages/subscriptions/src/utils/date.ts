export function isoToDateInput(value: string | undefined): string {
  if (!value) return '';
  // Expect ISO, display YYYY-MM-DD
  return value.slice(0, 10);
}

export function dateInputToIso(value: string | undefined): string | undefined {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) return undefined;

  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}
