export function titleCase(value: string): string {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/^./, (s) => s.toUpperCase());
}

export function enumOptions<T extends Record<string, string>>(
  obj: T
): string[] {
  return Object.values(obj);
}

export function parseEnumValue<T extends Record<string, string>>(
  obj: T,
  input: string,
  fallback: T[keyof T]
): T[keyof T] {
  const trimmed = input.trim();
  if (!trimmed) return fallback;

  const lower = trimmed.toLowerCase();

  for (const option of Object.values(obj)) {
    if (option.toLowerCase() === lower) return option as T[keyof T];
  }

  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === lower) {
      return obj[key as keyof T];
    }
  }

  return fallback;
}
