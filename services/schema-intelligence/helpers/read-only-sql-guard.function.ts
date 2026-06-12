/**
 * Read-only guard for `executeReadOnlyQuery`: fast-fail hygiene before SQL hits MySQL.
 * Rejects non-SELECT/WITH statements and multi-statement attempts (semicolons). Throwing
 * is left to the caller so this stays a pure, Nest-free, easily tested function.
 *
 * This is not the security boundary — use a MySQL user with SELECT-only grants on the
 * target schema. These checks return 400 early instead of a DB error.
 *
 * Behaviour and testing: docs/services/schema-intelligence.md
 */

export function findReadOnlySqlViolation(sql: string): string | null {
  const normalized = sql.trim().replace(/\s+/g, ' ');

  if (!/^(select|with)\b/i.test(normalized)) {
    return 'Only SELECT/WITH queries are allowed';
  }
  if (normalized.includes(';')) {
    return 'Semicolons are not allowed in SQL';
  }
  return null;
}
