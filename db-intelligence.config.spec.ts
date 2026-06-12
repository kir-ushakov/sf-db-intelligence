import {
  DEFAULT_DB_INTELLIGENCE_CONFIG,
  resolveDbIntelligenceConfig,
} from './db-intelligence.config';

describe('resolveDbIntelligenceConfig', () => {
  it('returns defaults when called without input', () => {
    expect(resolveDbIntelligenceConfig()).toEqual(
      DEFAULT_DB_INTELLIGENCE_CONFIG,
    );
  });

  it('merges partial llm overrides', () => {
    expect(
      resolveDbIntelligenceConfig({
        llm: { timeoutMs: 30_000, schemaMaxChars: 50_000 },
      }),
    ).toEqual({
      llm: {
        ...DEFAULT_DB_INTELLIGENCE_CONFIG.llm,
        timeoutMs: 30_000,
        schemaMaxChars: 50_000,
      },
    });
  });
});
