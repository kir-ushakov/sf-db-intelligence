/**
 * Typed shape of the schema snapshot returned by `SchemaIntelligenceService.getDatabaseSchema()`.
 *
 * One JSON-serializable tree: database name, per-table columns and indexes, and foreign keys.
 * `SchemaField` mixes raw MySQL metadata (`type`, `data_type`) with computed hints (`category`,
 * `select_risk`, `max_length`). `SelectRisk` is defined here and set by `classifySelectRisk`.
 *
 * Field-level detail: docs/services/schema-intelligence.md
 */
import { FieldCategory } from './field-category.enum';

export type SelectRisk = 'safe' | 'risky';
export interface SchemaField {
  type: string;
  data_type: string;
  category: FieldCategory;
  nullable: boolean;
  select_risk: SelectRisk;
  max_length?: number;
  primary_key?: boolean;
  default?: string | null;
  comment?: string;
}

export interface SchemaIndex {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface SchemaTable {
  approx_row_count: number;
  fields: Record<string, SchemaField>;
  indexes: SchemaIndex[];
  comment?: string;
}

export interface SchemaForeignKeySide {
  table: string;
  columns: string[];
}

export interface SchemaForeignKey {
  constraint: string;
  from: SchemaForeignKeySide;
  to: SchemaForeignKeySide;
}

export interface DatabaseSchema {
  database: string;
  tables: Record<string, SchemaTable>;
  foreign_keys: SchemaForeignKey[];
}
