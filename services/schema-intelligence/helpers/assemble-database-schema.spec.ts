import { ColumnRow, TableRow } from '../types/raw-rows.types';
import { assembleDatabaseSchema, RawSchemaRows } from './assemble-database-schema';

function tableRow(overrides: Partial<TableRow> = {}): TableRow {
  return { table_name: 'orders', table_rows: 10, table_comment: '', ...overrides };
}

function columnRow(overrides: Partial<ColumnRow> = {}): ColumnRow {
  return {
    table_name: 'orders',
    column_name: 'orderNumber',
    column_type: 'int',
    data_type: 'int',
    character_maximum_length: null,
    is_nullable: 'NO',
    column_key: 'PRI',
    column_default: null,
    column_comment: '',
    ...overrides,
  };
}

function raw(overrides: Partial<RawSchemaRows> = {}): RawSchemaRows {
  return {
    database: 'classicmodels',
    tables: [],
    columns: [],
    indexes: [],
    foreignKeys: [],
    ...overrides,
  };
}

describe('assembleDatabaseSchema', () => {
  it('builds tables with row counts, optional comments, fields and indexes', () => {
    const schema = assembleDatabaseSchema(
      raw({
        tables: [tableRow({ table_comment: 'sales orders' })],
        columns: [columnRow()],
        indexes: [
          {
            table_name: 'orders',
            index_name: 'PRIMARY',
            column_name: 'orderNumber',
            non_unique: 0,
          },
        ],
      }),
    );

    expect(schema.database).toBe('classicmodels');
    expect(schema.tables.orders.approx_row_count).toBe(10);
    expect(schema.tables.orders.comment).toBe('sales orders');
    expect(schema.tables.orders.fields.orderNumber.primary_key).toBe(true);
    expect(schema.tables.orders.indexes).toEqual([
      { name: 'PRIMARY', columns: ['orderNumber'], unique: true },
    ]);
  });

  it('drops columns and indexes referencing an unknown table', () => {
    const schema = assembleDatabaseSchema(
      raw({
        tables: [tableRow()],
        columns: [columnRow({ table_name: 'ghost' })],
        indexes: [
          {
            table_name: 'ghost',
            index_name: 'idx_x',
            column_name: 'x',
            non_unique: 1,
          },
        ],
      }),
    );

    expect(Object.keys(schema.tables.orders.fields)).toEqual([]);
    expect(schema.tables.orders.indexes).toEqual([]);
  });

  it('coerces a null TABLE_ROWS to 0 and omits empty comments', () => {
    const schema = assembleDatabaseSchema(
      raw({ tables: [tableRow({ table_rows: null, table_comment: '' })] }),
    );

    expect(schema.tables.orders.approx_row_count).toBe(0);
    expect(schema.tables.orders).not.toHaveProperty('comment');
  });
});
