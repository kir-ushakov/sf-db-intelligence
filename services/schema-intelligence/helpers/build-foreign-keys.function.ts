/**
 * Aggregates KEY_COLUMN_USAGE rows into one entry per constraint, preserving
 * ordinal column order on both sides. Rows are expected pre-sorted by
 * (constraint, ordinal_position). FKs whose local table is absent from the
 * snapshot are skipped. Output is sorted by local table then constraint name.
 *
 * Field-level detail: docs/services/schema-intelligence.md
 */
import { ForeignKeyRow } from '../types/raw-rows.types';
import { SchemaForeignKey } from '../types/schema.types';

export function buildForeignKeys(
  rows: readonly ForeignKeyRow[],
  knownTables: ReadonlySet<string>,
): SchemaForeignKey[] {
  const byConstraint = new Map<string, SchemaForeignKey>();

  for (const fk of rows) {
    if (!knownTables.has(fk.table_name)) {
      continue;
    }

    const key = `${fk.constraint_name}::${fk.table_name}`;
    const existing = byConstraint.get(key);
    if (!existing) {
      byConstraint.set(key, {
        constraint: fk.constraint_name,
        from: { table: fk.table_name, columns: [fk.column_name] },
        to: { table: fk.referenced_table, columns: [fk.referenced_column] },
      });
      continue;
    }

    existing.from.columns.push(fk.column_name);
    existing.to.columns.push(fk.referenced_column);
  }

  return Array.from(byConstraint.values()).sort((a, b) => {
    const byTable = a.from.table.localeCompare(b.from.table);
    return byTable !== 0 ? byTable : a.constraint.localeCompare(b.constraint);
  });
}
