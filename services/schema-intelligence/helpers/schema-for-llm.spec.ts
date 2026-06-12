import {
  DEFAULT_SCHEMA_MAX_CHARS,
  formatSchemaForLlm,
} from './schema-for-llm';
import { FieldCategory } from '../types/field-category.enum';
import type { DatabaseSchema, SchemaField, SchemaTable } from '../types/schema.types';

function makeField(overrides: Partial<SchemaField> = {}): SchemaField {
  return {
    type: 'varchar(15)',
    data_type: 'varchar',
    category: FieldCategory.SCALAR,
    nullable: false,
    select_risk: 'safe',
    ...overrides,
  };
}

function makeTable(
  fields: Record<string, SchemaField>,
  overrides: Partial<SchemaTable> = {},
): SchemaTable {
  return {
    approx_row_count: 100,
    indexes: [{ name: 'PRIMARY', columns: ['id'], unique: true }],
    fields,
    comment: 'Orders table',
    ...overrides,
  };
}

function makeSchema(
  tables: Record<string, SchemaTable>,
): DatabaseSchema {
  return {
    database: 'classicmodels',
    tables,
    foreign_keys: [],
  };
}

describe('formatSchemaForLlm', () => {
  it('returns pretty-printed JSON for small schemas', () => {
    const schema = makeSchema({
      orders: makeTable({ status: makeField() }),
    });

    const { json, compacted } = formatSchemaForLlm(schema);

    expect(compacted).toBe(false);
    expect(json).toBe(JSON.stringify(schema, null, 2));
  });

  it('compacts by dropping indexes, row counts, and comments when over budget', () => {
    const schema = makeSchema({
      orders: makeTable(
        {
          status: makeField({ comment: 'Order status' }),
          notes: makeField({ select_risk: 'risky', comment: 'Internal notes' }),
        },
        { comment: 'Orders table' },
      ),
    });

    const { json, compacted } = formatSchemaForLlm(schema, 200);

    expect(compacted).toBe(true);
    const parsed = JSON.parse(json) as DatabaseSchema;
    expect(parsed.tables.orders.indexes).toEqual([]);
    expect(parsed.tables.orders.approx_row_count).toBe(0);
    expect(parsed.tables.orders.comment).toBeUndefined();
    expect(parsed.tables.orders.fields.notes).toBeUndefined();
    expect(parsed.tables.orders.fields.status.comment).toBeUndefined();
  });

  it('caps the number of tables when the schema is still too large', () => {
    const tables: Record<string, SchemaTable> = {};
    for (let i = 0; i < 5; i++) {
      tables[`table_${i}`] = makeTable({
        [`col_${i}`]: makeField({ comment: 'x'.repeat(200) }),
      });
    }
    const schema = makeSchema(tables);

    const { json, compacted, omittedTables } = formatSchemaForLlm(schema, 800);

    expect(compacted).toBe(true);
    expect(omittedTables?.length).toBeGreaterThan(0);
    const parsed = JSON.parse(json) as DatabaseSchema;
    expect(Object.keys(parsed.tables).length).toBeLessThan(5);
  });

  it('accepts a custom character budget', () => {
    const schema = makeSchema({
      orders: makeTable({ status: makeField({ comment: 'x'.repeat(100) }) }),
    });

    const { compacted } = formatSchemaForLlm(schema, 150);

    expect(compacted).toBe(true);
  });

  it('defaults the character budget to DEFAULT_SCHEMA_MAX_CHARS', () => {
    const schema = makeSchema({
      orders: makeTable({ status: makeField() }),
    });

    expect(formatSchemaForLlm(schema).json.length).toBeLessThanOrEqual(
      DEFAULT_SCHEMA_MAX_CHARS,
    );
  });
});
