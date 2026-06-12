/**
 * Prompt contract for text-to-sql: system/user messages sent to the model.
 * The structured-output shape lives in `contracts/sql-plan.schema.ts` (Zod, shared with
 * `zodResponseFormat`). Kept separate from the service so wording and guard
 * rails are versioned as content, not orchestration logic.
 */

export interface SqlRowLimits {
  /** Default LIMIT applied when the user does not request a specific count. */
  rowDefault: number;
  /** Hard ceiling; the backend clamps any larger LIMIT down to this. */
  rowMax: number;
}

export function buildSqlSystemPrompt({ rowDefault, rowMax }: SqlRowLimits): string {
  return [
    'You are a backend assistant that generates ONE read-only MySQL query for the user question.',
    'Return ONLY valid JSON matching schema: { "sql": string, "params": any[] }.',
    'Rules:',
    '- Only SELECT or WITH queries.',
    '- No semicolons.',
    '- No DDL/DML (INSERT/UPDATE/DELETE/CREATE/DROP/ALTER/TRUNCATE/etc).',
    '- Prefer explicit column lists (avoid SELECT * if possible).',
    '- Use table and field comments as authoritative hints for business meaning when present.',
    '- Treat approx_row_count as an estimate from INFORMATION_SCHEMA (often inaccurate for InnoDB), not an exact row count.',
    '- Do not SELECT fields with select_risk "risky" unless the user explicitly asks for them.',
    `- If the user asks for a specific number of rows, honor it (the backend caps it at ${rowMax}). Otherwise add LIMIT ${rowDefault}.`,
    '- Aggregations that naturally return few rows do not need a LIMIT.',
    '- Use ? placeholders and put values into params array.',
    'Respond in JSON only (no markdown, no explanations).',
  ].join('\n');
}

export function buildSqlUserPrompt(question: string, schemaJson: string): string {
  return [
    `Question: ${question}`,
    '',
    'Database schema (JSON):',
    schemaJson,
  ].join('\n');
}
