/**
 * Maps one INFORMATION_SCHEMA column row to an enriched `SchemaField`: raw MySQL
 * metadata plus computed `category`, `max_length`, and `select_risk`. Optional
 * snapshot fields (`primary_key`, `default`, `comment`) are omitted when absent.
 *
 * Field-level detail: docs/services/schema-intelligence.md
 */
import { ColumnRow } from '../types/raw-rows.types';import { SchemaField } from '../types/schema.types';
import { classifyColumn } from './classify-column.function';
import { classifySelectRisk } from './classify-select-risk';
import { effectiveCharMaxLength } from './effective-char-max-length.function';

export function buildField(column: ColumnRow): SchemaField {
  const category = classifyColumn(column.data_type);
  const maxLength = effectiveCharMaxLength(
    column.data_type,
    column.character_maximum_length,
  );

  const field: SchemaField = {
    type: column.column_type,
    data_type: column.data_type,
    category,
    nullable: column.is_nullable === 'YES',
    select_risk: classifySelectRisk(category, maxLength),
  };

  if (maxLength !== null) {
    field.max_length = maxLength;
  }

  if (column.column_key === 'PRI') {
    field.primary_key = true;
  }

  if (column.column_default !== null) {
    field.default = column.column_default;
  }

  if (column.column_comment) {
    field.comment = column.column_comment;
  }

  return field;
}
