import { IndexRow } from '../types/raw-rows.types';
import { buildIndexes } from './build-indexes.function';

function indexRow(overrides: Partial<IndexRow> = {}): IndexRow {
  return {
    table_name: 'orders',
    index_name: 'idx_orders_customer',
    column_name: 'customerNumber',
    non_unique: 1,
    ...overrides,
  };
}

describe('buildIndexes', () => {
  it('aggregates multi-column indexes in column order', () => {
    const rows = [
      indexRow({ column_name: 'a', index_name: 'idx_ab' }),
      indexRow({ column_name: 'b', index_name: 'idx_ab' }),
    ];

    const result = buildIndexes(rows, new Set(['orders']));

    expect(result.orders).toEqual([
      { name: 'idx_ab', columns: ['a', 'b'], unique: false },
    ]);
  });

  it('keeps separate entries when the same column appears in multiple indexes', () => {
    const rows = [
      indexRow({ column_name: 'status', index_name: 'idx_status' }),
      indexRow({ column_name: 'status', index_name: 'idx_status_created' }),
      indexRow({
        column_name: 'createdAt',
        index_name: 'idx_status_created',
      }),
    ];

    const result = buildIndexes(rows, new Set(['orders']));

    expect(result.orders).toEqual([
      { name: 'idx_status', columns: ['status'], unique: false },
      { name: 'idx_status_created', columns: ['status', 'createdAt'], unique: false },
    ]);
  });

  it('skips indexes on tables not in the snapshot', () => {
    const rows = [indexRow({ table_name: 'ghost' })];

    expect(buildIndexes(rows, new Set(['orders']))).toEqual({});
  });

  it('sorts indexes by name within each table', () => {
    const rows = [
      indexRow({ index_name: 'idx_b', column_name: 'b' }),
      indexRow({ index_name: 'idx_a', column_name: 'a' }),
    ];

    const result = buildIndexes(rows, new Set(['orders']));

    expect(result.orders.map((index) => index.name)).toEqual(['idx_a', 'idx_b']);
  });
});
