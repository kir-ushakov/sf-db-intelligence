/**
 * Plain shapes of the INFORMATION_SCHEMA rows read by `SchemaIntelligenceService`.
 *
 * Kept free of `mysql2`'s `RowDataPacket` so the pure assembly helpers
 * (`build-field.function`, `build-foreign-keys.function`, `assemble-database-schema`) can be unit
 * tested with literals. The service intersects these with `RowDataPacket` at the
 * query call site.
 *
 * Field-level detail: docs/services/schema-intelligence.md
 */

export interface TableRow {
  table_name: string;
  table_rows: number | null;
  table_comment: string;
}

export interface ColumnRow {
  table_name: string;
  column_name: string;
  column_type: string;
  data_type: string;
  character_maximum_length: number | null;
  is_nullable: 'YES' | 'NO';
  column_key: '' | 'PRI' | 'UNI' | 'MUL';
  column_default: string | null;
  column_comment: string;
}

export interface ForeignKeyRow {
  constraint_name: string;
  table_name: string;
  column_name: string;
  referenced_table: string;
  referenced_column: string;
  ordinal_position: number;
}

export interface IndexRow {
  table_name: string;
  index_name: string;
  column_name: string;
  non_unique: 0 | 1;
}
