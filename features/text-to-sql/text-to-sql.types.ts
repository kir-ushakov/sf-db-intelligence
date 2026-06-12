export interface SqlQuery {
  sql: string;
  params: unknown[];
}

export interface TextToSqlResult {
  question: string;
  sql: string;
  params: unknown[];
  rows: unknown[];
  /** Effective row cap applied to the query (default, explicit, or clamped to max). */
  rowLimit: number;
  /** True when the result hit `rowLimit`, so more rows may exist beyond it. */
  truncated: boolean;
}
