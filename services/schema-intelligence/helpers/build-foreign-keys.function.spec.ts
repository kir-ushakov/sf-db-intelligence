import { ForeignKeyRow } from '../types/raw-rows.types';
import { buildForeignKeys } from './build-foreign-keys.function';

function fkRow(overrides: Partial<ForeignKeyRow> = {}): ForeignKeyRow {
  return {
    constraint_name: 'fk_orders_customer',
    table_name: 'orders',
    column_name: 'customerNumber',
    referenced_table: 'customers',
    referenced_column: 'customerNumber',
    ordinal_position: 1,
    ...overrides,
  };
}

describe('buildForeignKeys', () => {
  it('aggregates multi-column constraints in ordinal order', () => {
    const rows = [
      fkRow({ column_name: 'a', referenced_column: 'x', ordinal_position: 1 }),
      fkRow({ column_name: 'b', referenced_column: 'y', ordinal_position: 2 }),
    ];

    const result = buildForeignKeys(rows, new Set(['orders']));

    expect(result).toHaveLength(1);
    expect(result[0].from.columns).toEqual(['a', 'b']);
    expect(result[0].to.columns).toEqual(['x', 'y']);
  });

  it('skips FKs whose local table is not in the snapshot', () => {
    const rows = [fkRow({ table_name: 'unknown' })];

    expect(buildForeignKeys(rows, new Set(['orders']))).toEqual([]);
  });

  it('sorts by local table then constraint name', () => {
    const rows = [
      fkRow({ table_name: 'orders', constraint_name: 'fk_b' }),
      fkRow({ table_name: 'orders', constraint_name: 'fk_a' }),
      fkRow({ table_name: 'customers', constraint_name: 'fk_c' }),
    ];

    const result = buildForeignKeys(rows, new Set(['orders', 'customers']));

    expect(result.map((fk) => `${fk.from.table}.${fk.constraint}`)).toEqual([
      'customers.fk_c',
      'orders.fk_a',
      'orders.fk_b',
    ]);
  });
});
