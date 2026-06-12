/**
 * Bounds the row count of a generated read-only query.
 *
 * Only the **outermost** terminal `LIMIT` is considered: inner limits in
 * subqueries or per-branch UNION limits do not satisfy the cap. When no outer
 * limit exists, one is appended at the end (valid for plain SELECT, WITH, and
 * UNION). Explicit limits above `max` are clamped in place.
 *
 * Returns the rewritten SQL and the effective row count, so the caller can
 * detect truncation (`rows.length === limit`). Supports the three MySQL forms:
 * `LIMIT n`, `LIMIT offset, n`, and `LIMIT n OFFSET offset`.
 *
 * Behaviour and testing: docs/features/text-to-sql.md
 */
import { findOuterLimit } from './find-outer-limit.function';

export interface RowLimitResult {
  sql: string;
  limit: number;
}

export interface RowLimitOptions {
  fallback: number;
  max: number;
}

function clampLimitClause(
  clause: string,
  rowCount: number,
  countIsSecond: boolean,
): string {
  if (countIsSecond) {
    return clause.replace(/(\d+)\s*$/, String(rowCount));
  }
  return clause.replace(/\d+/, String(rowCount));
}

export function applyRowLimit(
  sql: string,
  { fallback, max }: RowLimitOptions,
): RowLimitResult {
  const trimmed = sql.trim();
  const outer = findOuterLimit(trimmed);

  if (!outer) {
    const limit = Math.min(fallback, max);
    return { sql: `${trimmed} LIMIT ${limit}`, limit };
  }

  const limit = Math.min(outer.rowCount, max);

  if (limit === outer.rowCount) {
    return { sql: trimmed, limit };
  }

  const clampedClause = clampLimitClause(outer.text, limit, outer.countIsSecond);
  const clampedSql =
    trimmed.slice(0, outer.start) +
    clampedClause +
    trimmed.slice(outer.start + outer.length);

  return { sql: clampedSql, limit };
}
