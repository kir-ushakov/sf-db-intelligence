/**
 * Lenient coercion of optional env strings to typed values for db-intelligence.
 *
 * Tuning vars (`MYSQL_*`) are optional: missing or unparseable values fall back
 * to the provided default instead of throwing. Required secrets (the OpenAI key)
 * are validated separately at module init, not here.
 */
export function parseBoolean(
  value: string | undefined,
  defaultValue: boolean,
): boolean {
  if (value === undefined) {
    return defaultValue;
  }
  return value === '1' || value.toLowerCase() === 'true';
}

export function parsePort(value: string | undefined, defaultValue: number): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function parseNonNegativeInt(
  value: string | undefined,
  defaultValue: number,
): number {
  if (value === undefined) {
    return defaultValue;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
}
