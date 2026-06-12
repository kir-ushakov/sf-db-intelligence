/**
 * Pure assembly of a `DatabaseSchema` snapshot from raw INFORMATION_SCHEMA rows.
 *
 * Tables are created first; columns and indexes referencing an unknown table are
 * dropped (defensive against schema drift between the four queries). Column and
 * FK detail are delegated to `build-field.function` / `build-foreign-keys.function` / `build-indexes.function`.
 *
 * Field-level detail: docs/services/schema-intelligence.md
 */
import {
  ColumnRow,
  ForeignKeyRow,
  IndexRow,
  TableRow,
} from '../types/raw-rows.types';
import { DatabaseSchema, SchemaTable } from '../types/schema.types';
import { buildField } from './build-field.function';
import { buildForeignKeys } from './build-foreign-keys.function';
import { buildIndexes } from './build-indexes.function';

export interface RawSchemaRows {
  database: string;
  tables: readonly TableRow[];
  columns: readonly ColumnRow[];
  indexes: readonly IndexRow[];
  foreignKeys: readonly ForeignKeyRow[];
}

export function assembleDatabaseSchema(raw: RawSchemaRows): DatabaseSchema {
  const tables: Record<string, SchemaTable> = {};

  for (const table of raw.tables) {
    const schemaTable: SchemaTable = {
      approx_row_count: Number(table.table_rows ?? 0),
      fields: {},
      indexes: [],
    };

    if (table.table_comment) {
      schemaTable.comment = table.table_comment;
    }

    tables[table.table_name] = schemaTable;
  }

  for (const column of raw.columns) {
    const table = tables[column.table_name];
    if (table) {
      table.fields[column.column_name] = buildField(column);
    }
  }

  const knownTables = new Set(Object.keys(tables));
  const indexesByTable = buildIndexes(raw.indexes, knownTables);
  for (const [tableName, indexes] of Object.entries(indexesByTable)) {
    tables[tableName].indexes = indexes;
  }

  return {
    database: raw.database,
    tables,
    foreign_keys: buildForeignKeys(raw.foreignKeys, knownTables),
  };
}
