/**
 * Aggregates STATISTICS rows into one entry per index, preserving column order
 * within each index. Rows are expected pre-sorted by (table, index_name,
 * seq_in_index). Indexes on tables absent from the snapshot are skipped. Output
 * per table is sorted by index name.
 *
 * Field-level detail: docs/services/schema-intelligence.md
 */
import { IndexRow } from '../types/raw-rows.types';
import { SchemaIndex } from '../types/schema.types';

export function buildIndexes(
  rows: readonly IndexRow[],
  knownTables: ReadonlySet<string>,
): Record<string, SchemaIndex[]> {
  const byTable = new Map<string, Map<string, SchemaIndex>>();

  for (const row of rows) {
    if (!knownTables.has(row.table_name)) {
      continue;
    }

    let tableIndexes = byTable.get(row.table_name);
    if (!tableIndexes) {
      tableIndexes = new Map();
      byTable.set(row.table_name, tableIndexes);
    }

    const existing = tableIndexes.get(row.index_name);
    if (!existing) {
      tableIndexes.set(row.index_name, {
        name: row.index_name,
        columns: [row.column_name],
        unique: row.non_unique === 0,
      });
      continue;
    }

    existing.columns.push(row.column_name);
  }

  const result: Record<string, SchemaIndex[]> = {};
  for (const [tableName, indexMap] of byTable) {
    result[tableName] = Array.from(indexMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  return result;
}
