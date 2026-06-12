/**
 * LLM tuning for db-intelligence. The OpenAI key and model live in
 * `openai.config.ts`; everything here is behavioural tuning passed via
 * `DbIntelligenceModule.forRoot({ llm: { ... } })`.
 */
export interface DbIntelligenceLlmConfig {
  /** Per-request HTTP timeout for the OpenAI SDK client (ms). */
  timeoutMs: number;

  /** How many times the SDK retries transient API/network failures. */
  maxRetries: number;

  /** Max completion tokens for text-to-sql (`{ sql, params }` JSON). */
  sqlMaxTokens: number;

  /** Default `LIMIT` injected when a generated query has no explicit limit. */
  sqlRowDefault: number;

  /**
   * Hard ceiling on returned rows. An explicit `LIMIT` above this is clamped
   * down (results flagged `truncated`), protecting the backend from oversized
   * result sets even when the user asks for more.
   */
  sqlRowMax: number;

  /**
   * Sampling temperature for text-to-sql (0–2).
   * Lower = more deterministic SQL for the same prompt; 0 is recommended.
   */
  sqlTemperature: number;

  /**
   * Max length of serialized schema JSON (chars) embedded in the prompt.
   * `formatSchemaForLlm` compacts or drops tables when over budget.
   */
  schemaMaxChars: number;
}

export interface DbIntelligenceConfig {
  llm: DbIntelligenceLlmConfig;
}

import type { MysqlConfig } from './mysql.config';
import type { OpenAiConfigInput } from './openai.config';

export type DbIntelligenceConfigInput = {
  llm?: Partial<DbIntelligenceLlmConfig>;
  mysql?: Partial<MysqlConfig>;
  openai?: OpenAiConfigInput;
};

export const DB_INTELLIGENCE_CONFIG = Symbol('DB_INTELLIGENCE_CONFIG');

export const DEFAULT_DB_INTELLIGENCE_CONFIG: DbIntelligenceConfig = {
  llm: {
    timeoutMs: 60_000,
    maxRetries: 2,
    sqlMaxTokens: 1_024,
    sqlRowDefault: 200,
    sqlRowMax: 2_000,
    sqlTemperature: 0,
    schemaMaxChars: 120_000,
  },
};

export function resolveDbIntelligenceConfig(
  input: DbIntelligenceConfigInput = {},
): DbIntelligenceConfig {
  return {
    llm: {
      ...DEFAULT_DB_INTELLIGENCE_CONFIG.llm,
      ...input.llm,
    },
  };
}
