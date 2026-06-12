import { FieldCategory } from '../types/field-category.enum';
import { ColumnRow } from '../types/raw-rows.types';
import { buildField } from './build-field.function';

function column(overrides: Partial<ColumnRow> = {}): ColumnRow {
  return {
    table_name: 'orders',
    column_name: 'comments',
    column_type: 'varchar(255)',
    data_type: 'varchar',
    character_maximum_length: 255,
    is_nullable: 'YES',
    column_key: '',
    column_default: null,
    column_comment: '',
    ...overrides,
  };
}

describe('buildField', () => {
  it('maps raw metadata and classifies a safe scalar column', () => {
    const field = buildField(column());

    expect(field).toEqual({
      type: 'varchar(255)',
      data_type: 'varchar',
      category: FieldCategory.SCALAR,
      nullable: true,
      select_risk: 'safe',
      max_length: 255,
    });
  });

  it('omits optional props that are absent in MySQL', () => {
    const field = buildField(
      column({ data_type: 'int', column_type: 'int', character_maximum_length: null }),
    );

    expect(field).not.toHaveProperty('max_length');
    expect(field).not.toHaveProperty('primary_key');
    expect(field).not.toHaveProperty('default');
    expect(field).not.toHaveProperty('comment');
  });

  it('marks primary keys, defaults, comments and non-null', () => {
    const field = buildField(
      column({
        is_nullable: 'NO',
        column_key: 'PRI',
        column_default: '0',
        column_comment: 'order line number',
      }),
    );

    expect(field.nullable).toBe(false);
    expect(field.primary_key).toBe(true);
    expect(field.default).toBe('0');
    expect(field.comment).toBe('order line number');
  });

  it('flags large text columns as risky', () => {
    const field = buildField(
      column({ data_type: 'text', column_type: 'text', character_maximum_length: null }),
    );

    expect(field.category).toBe(FieldCategory.TEXT);
    expect(field.select_risk).toBe('risky');
    expect(field.max_length).toBe(65_535);
  });
});
