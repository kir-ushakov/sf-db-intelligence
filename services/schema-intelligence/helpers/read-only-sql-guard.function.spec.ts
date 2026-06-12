import { findReadOnlySqlViolation } from './read-only-sql-guard.function';

describe('findReadOnlySqlViolation', () => {
  it('allows SELECT and WITH queries', () => {
    expect(findReadOnlySqlViolation('SELECT 1')).toBeNull();
    expect(
      findReadOnlySqlViolation('  with t as (select 1) select * from t  '),
    ).toBeNull();
  });

  it('rejects non-read statements by start keyword', () => {
    expect(findReadOnlySqlViolation('DELETE FROM orders')).toBe(
      'Only SELECT/WITH queries are allowed',
    );
  });

  it('rejects multi-statement attempts via semicolons', () => {
    expect(findReadOnlySqlViolation('SELECT 1; DROP TABLE orders')).toBe(
      'Semicolons are not allowed in SQL',
    );
  });

  it('allows DML/DDL words inside string literals and identifiers', () => {
    expect(
      findReadOnlySqlViolation('SELECT * FROM orders WHERE x IN (UPDATE)'),
    ).toBeNull();
    expect(
      findReadOnlySqlViolation("SELECT * FROM notes WHERE body = 'please delete'"),
    ).toBeNull();
    expect(
      findReadOnlySqlViolation('SELECT last_update FROM users'),
    ).toBeNull();
  });
});
