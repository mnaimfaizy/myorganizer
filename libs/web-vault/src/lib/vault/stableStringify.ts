/**
 * A deterministic string for any JSON-shaped value, used to answer "are these
 * two the same?" without depending on key order.
 *
 * Shared rather than duplicated because Vault Meta convergence and Vault
 * Reconcile both compare structures the server round-trips, and two
 * comparison functions that disagree about key order — or about how `NaN`
 * prints — would report divergence that is not there.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'null';

  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return '{"$number":"NaN"}';
    }
    if (value === Number.POSITIVE_INFINITY) {
      return '{"$number":"Infinity"}';
    }
    if (value === Number.NEGATIVE_INFINITY) {
      return '{"$number":"-Infinity"}';
    }
    return JSON.stringify(value);
  }

  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((k) => record[k] !== undefined)
    .sort();
  return `{${keys
    .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`)
    .join(',')}}`;
}
