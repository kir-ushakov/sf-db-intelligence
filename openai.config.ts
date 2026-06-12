/**
 * OpenAI connection config for db-intelligence (API key + model).
 *
 * Self-contained: resolved from env (`OPENAI_API_KEY`, `OPENAI_MODEL`) merged
 * with `DbIntelligenceModule.forRoot({ openai })` overrides, so the module does
 * not depend on the host app validating the key. The key is required — a
 * missing/empty value throws at module init (fail fast) instead of surfacing as
 * a 401 on the first LLM call. LLM tuning (timeouts, tokens) lives in
 * `db-intelligence.config.ts`.
 *
 * Overview: docs/README.md
 */
export const OPENAI_CONFIG = Symbol('OPENAI_CONFIG');

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export interface OpenAiConfig {
  apiKey: string;
  model: string;
}

export interface OpenAiConfigInput {
  apiKey?: string;
  model?: string;
}

export function resolveOpenAiConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: OpenAiConfigInput = {},
): OpenAiConfig {
  const apiKey = overrides.apiKey ?? env.OPENAI_API_KEY ?? '';
  if (apiKey.length === 0) {
    throw new Error('OPENAI_API_KEY is required for db-intelligence');
  }
  return {
    apiKey,
    model: overrides.model ?? env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  };
}
