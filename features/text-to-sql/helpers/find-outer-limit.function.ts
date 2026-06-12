/**
 * Locates the terminal `LIMIT` clause at the outer query level (parenthesis
 * depth 0). Inner limits in subqueries or UNION branches are ignored so the
 * caller can add or clamp only the bound that MySQL applies to the full result.
 */

export interface OuterLimitMatch {
  /** Index of the `LIMIT` keyword. */
  start: number;
  /** Byte length of the whole clause (keyword through optional OFFSET). */
  length: number;
  /** Effective row cap encoded in the clause. */
  rowCount: number;
  /** True when the clause uses `LIMIT offset, count` (count is the second number). */
  countIsSecond: boolean;
  /** Matched source slice (for in-place replacement). */
  text: string;
}

const LIMIT_KEYWORD = 'limit';
const LIMIT_ARGS =
  /^\s+(\d+)(?:\s*,\s*(\d+))?(?:\s+offset\s+\d+)?/i;

function isWordChar(ch: string): boolean {
  return /[\w]/.test(ch);
}

function isKeywordAt(sql: string, index: number, keyword: string): boolean {
  if (index + keyword.length > sql.length) {
    return false;
  }
  if (!sql.slice(index, index + keyword.length).match(new RegExp(keyword, 'i'))) {
    return false;
  }
  const before = index > 0 ? sql[index - 1]! : ' ';
  const after = sql[index + keyword.length] ?? ' ';
  return !isWordChar(before) && !isWordChar(after);
}

function skipWhitespace(sql: string, index: number): number {
  while (index < sql.length && /\s/.test(sql[index]!)) {
    index += 1;
  }
  return index;
}

function skipLineComment(sql: string, index: number): number {
  let i = index + 2;
  while (i < sql.length && sql[i] !== '\n') {
    i += 1;
  }
  return i;
}

function skipBlockComment(sql: string, index: number): number {
  let i = index + 2;
  while (i < sql.length - 1) {
    if (sql[i] === '*' && sql[i + 1] === '/') {
      return i + 2;
    }
    i += 1;
  }
  return sql.length;
}

function skipQuotedString(sql: string, index: number): number {
  const quote = sql[index]!;
  let i = index + 1;
  while (i < sql.length) {
    if (sql[i] === '\\') {
      i += 2;
      continue;
    }
    if (sql[i] === quote) {
      return i + 1;
    }
    i += 1;
  }
  return sql.length;
}

function parseLimitClause(
  sql: string,
  keywordStart: number,
): Pick<OuterLimitMatch, 'length' | 'rowCount' | 'countIsSecond' | 'text'> | null {
  const afterKeyword = sql.slice(keywordStart + LIMIT_KEYWORD.length);
  const args = LIMIT_ARGS.exec(afterKeyword);
  if (!args) {
    return null;
  }

  const countIsSecond = args[2] !== undefined;
  const rowCount = Number(countIsSecond ? args[2] : args[1]);
  const length = LIMIT_KEYWORD.length + args[0].length;

  return {
    length,
    rowCount,
    countIsSecond,
    text: sql.slice(keywordStart, keywordStart + length),
  };
}

/**
 * Returns the outermost terminal LIMIT, or `null` when the query has no
 * top-level row cap (including when LIMIT appears only inside subqueries).
 */
export function findOuterLimit(sql: string): OuterLimitMatch | null {
  let depth = 0;
  let index = 0;
  let lastAtDepthZero: OuterLimitMatch | null = null;

  while (index < sql.length) {
    const ch = sql[index]!;

    if (/\s/.test(ch)) {
      index = skipWhitespace(sql, index);
      continue;
    }

    if (ch === '-' && sql[index + 1] === '-') {
      index = skipLineComment(sql, index);
      continue;
    }

    if (ch === '/' && sql[index + 1] === '*') {
      index = skipBlockComment(sql, index);
      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      index = skipQuotedString(sql, index);
      continue;
    }

    if (ch === '(') {
      depth += 1;
      index += 1;
      continue;
    }

    if (ch === ')') {
      depth = Math.max(0, depth - 1);
      index += 1;
      continue;
    }

    if (depth === 0 && isKeywordAt(sql, index, LIMIT_KEYWORD)) {
      const parsed = parseLimitClause(sql, index);
      if (parsed) {
        lastAtDepthZero = { start: index, ...parsed };
        index += parsed.length;
        continue;
      }
    }

    index += 1;
  }

  if (!lastAtDepthZero) {
    return null;
  }

  const tail = sql.slice(lastAtDepthZero.start + lastAtDepthZero.length).trim();
  if (tail.length > 0) {
    return null;
  }

  return lastAtDepthZero;
}
