import { applyRowLimit } from './apply-row-limit.function';
import { DEFAULT_DB_INTELLIGENCE_CONFIG } from '../../../db-intelligence.config';

const { sqlRowDefault, sqlRowMax } = DEFAULT_DB_INTELLIGENCE_CONFIG.llm;
const opts = { fallback: sqlRowDefault, max: sqlRowMax };

describe('applyRowLimit', () => {
  it('appends the fallback LIMIT when none is present', () => {
    expect(applyRowLimit('SELECT status FROM orders', opts)).toEqual({
      sql: `SELECT status FROM orders LIMIT ${sqlRowDefault}`,
      limit: sqlRowDefault,
    });
  });

  it('keeps an explicit outer LIMIT within max', () => {
    expect(applyRowLimit('SELECT 1 LIMIT 50', opts)).toEqual({
      sql: 'SELECT 1 LIMIT 50',
      limit: 50,
    });
  });

  it('clamps an explicit outer LIMIT above max', () => {
    expect(applyRowLimit('SELECT p FROM s ORDER BY n LIMIT 3000', opts)).toEqual({
      sql: `SELECT p FROM s ORDER BY n LIMIT ${sqlRowMax}`,
      limit: sqlRowMax,
    });
  });

  it('clamps the count in `LIMIT offset, count`', () => {
    expect(applyRowLimit('SELECT 1 LIMIT 10, 5000', opts)).toEqual({
      sql: `SELECT 1 LIMIT 10, ${sqlRowMax}`,
      limit: sqlRowMax,
    });
  });

  it('clamps the count in `LIMIT count OFFSET offset`', () => {
    expect(applyRowLimit('SELECT 1 LIMIT 5000 OFFSET 10', opts)).toEqual({
      sql: `SELECT 1 LIMIT ${sqlRowMax} OFFSET 10`,
      limit: sqlRowMax,
    });
  });

  it('detects LIMIT case-insensitively', () => {
    expect(applyRowLimit('SELECT 1 limit 9999', opts).limit).toBe(sqlRowMax);
  });

  it('adds an outer LIMIT when only a subquery has LIMIT', () => {
    expect(
      applyRowLimit('SELECT * FROM (SELECT id FROM orders LIMIT 10) t', opts),
    ).toEqual({
      sql: `SELECT * FROM (SELECT id FROM orders LIMIT 10) t LIMIT ${sqlRowDefault}`,
      limit: sqlRowDefault,
    });
  });

  it('adds an outer LIMIT on UNION when branches have inner limits only', () => {
    expect(
      applyRowLimit(
        '(SELECT id FROM orders LIMIT 50) UNION (SELECT id FROM customers LIMIT 50)',
        opts,
      ),
    ).toEqual({
      sql: `(SELECT id FROM orders LIMIT 50) UNION (SELECT id FROM customers LIMIT 50) LIMIT ${sqlRowDefault}`,
      limit: sqlRowDefault,
    });
  });

  it('does not clamp inner UNION branch limits', () => {
    const sql =
      '(SELECT id FROM orders LIMIT 5000) UNION (SELECT id FROM customers LIMIT 5000)';
    expect(applyRowLimit(sql, opts)).toEqual({
      sql: `${sql} LIMIT ${sqlRowDefault}`,
      limit: sqlRowDefault,
    });
  });

  it('clamps a terminal UNION LIMIT', () => {
    expect(
      applyRowLimit(
        'SELECT id FROM orders UNION SELECT id FROM customers LIMIT 5000',
        opts,
      ),
    ).toEqual({
      sql: `SELECT id FROM orders UNION SELECT id FROM customers LIMIT ${sqlRowMax}`,
      limit: sqlRowMax,
    });
  });
});
