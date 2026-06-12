import { findOuterLimit } from './find-outer-limit.function';

describe('findOuterLimit', () => {
  it('returns null when no LIMIT is present', () => {
    expect(findOuterLimit('SELECT 1 FROM t')).toBeNull();
  });

  it('finds a terminal outer LIMIT', () => {
    expect(findOuterLimit('SELECT 1 LIMIT 50')).toMatchObject({
      rowCount: 50,
      text: 'LIMIT 50',
    });
  });

  it('ignores LIMIT inside a subquery', () => {
    expect(findOuterLimit('SELECT * FROM (SELECT 1 LIMIT 99) t')).toBeNull();
  });

  it('finds LIMIT after a closing parenthesis at depth zero', () => {
    expect(findOuterLimit('SELECT * FROM (SELECT 1) t LIMIT 25')).toMatchObject({
      rowCount: 25,
    });
  });

  it('ignores LIMIT inside string literals', () => {
    expect(findOuterLimit("SELECT 'LIMIT 999' AS label FROM t")).toBeNull();
  });

  it('ignores LIMIT inside line comments', () => {
    expect(findOuterLimit('SELECT 1 FROM t -- LIMIT 999')).toBeNull();
  });

  it('returns null when LIMIT is not terminal', () => {
    expect(findOuterLimit('SELECT 1 LIMIT 10 OFFSET 0, extra')).toBeNull();
  });
});
