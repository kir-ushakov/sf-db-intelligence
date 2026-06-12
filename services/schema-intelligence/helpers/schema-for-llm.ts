/**
 * Schema-for-LLM serializer.
 *
 * Turns a `DatabaseSchema` snapshot into a JSON string that is safe to embed in
 * an LLM prompt while staying under a character budget.
 *
 * The strategy is "graceful degradation": try the full schema first, then drop
 * progressively less-essential metadata (indexes, row counts, comments, risky
 * fields). If it still does not fit, binary-search the number of tables that
 * does fit and report which tables were omitted, so callers can warn the user
 * about an incomplete view instead of silently truncating mid-JSON.
 */
import { DEFAULT_DB_INTELLIGENCE_CONFIG } from '../../../db-intelligence.config';
import type { DatabaseSchema, SchemaField, SchemaTable } from '../types/schema.types';

export const DEFAULT_SCHEMA_MAX_CHARS =
  DEFAULT_DB_INTELLIGENCE_CONFIG.llm.schemaMaxChars;

type SlimSchemaOptions = {
  omitIndexes?: boolean;
  omitRowCounts?: boolean;
  omitComments?: boolean;
  omitRiskyFields?: boolean;
  maxTables?: number;
};

function slimSchema(
  schema: DatabaseSchema,
  opts: SlimSchemaOptions,
): DatabaseSchema {
  const tableNames = Object.keys(schema.tables).sort();
  const selectedNames = opts.maxTables
    ? tableNames.slice(0, opts.maxTables)
    : tableNames;
  const selected = new Set(selectedNames);

  const tables: Record<string, SchemaTable> = {};
  for (const name of selectedNames) {
    const table = schema.tables[name];
    const fields: Record<string, SchemaField> = {};

    for (const [fieldName, field] of Object.entries(table.fields)) {
      if (opts.omitRiskyFields && field.select_risk === 'risky') {
        continue;
      }

      const slimField: SchemaField = {
        type: field.type,
        data_type: field.data_type,
        category: field.category,
        nullable: field.nullable,
        select_risk: field.select_risk,
      };
      if (field.primary_key) {
        slimField.primary_key = true;
      }
      if (!opts.omitComments && field.comment) {
        slimField.comment = field.comment;
      }
      if (field.max_length !== undefined) {
        slimField.max_length = field.max_length;
      }
      fields[fieldName] = slimField;
    }

    tables[name] = {
      approx_row_count: opts.omitRowCounts ? 0 : table.approx_row_count,
      fields,
      indexes: opts.omitIndexes ? [] : table.indexes,
      ...(opts.omitComments || !table.comment ? {} : { comment: table.comment }),
    };
  }

  return {
    database: schema.database,
    tables,
    foreign_keys: schema.foreign_keys.filter(
      (fk) => selected.has(fk.from.table) && selected.has(fk.to.table),
    ),
  };
}

function serializeSchema(schema: DatabaseSchema): string {
  const compact = JSON.stringify(schema);
  if (compact.length <= 20_000) {
    return JSON.stringify(schema, null, 2);
  }
  return compact;
}

function fits(schema: DatabaseSchema, maxChars: number): string | null {
  const json = serializeSchema(schema);
  return json.length <= maxChars ? json : null;
}

function slimWithTableCap(
  schema: DatabaseSchema,
  maxChars: number,
  baseOpts: Omit<SlimSchemaOptions, 'maxTables'>,
): { json: string; schema: DatabaseSchema } | null {
  const tableCount = Object.keys(schema.tables).length;
  if (tableCount === 0) {
    const json = fits(schema, maxChars);
    return json ? { json, schema } : null;
  }

  let low = 1;
  let high = tableCount;
  let best: { json: string; schema: DatabaseSchema } | null = null;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const slimmed = slimSchema(schema, { ...baseOpts, maxTables: mid });
    const candidate = fits(slimmed, maxChars);
    if (candidate) {
      best = { json: candidate, schema: slimmed };
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

export type SchemaForLlmResult = {
  json: string;
  compacted: boolean;
  omittedTables?: string[];
};

/**
 * Serializes a schema snapshot for LLM prompts, staying within a character budget
 * by progressively dropping non-essential metadata and, if needed, table subsets.
 */
export function formatSchemaForLlm(
  schema: DatabaseSchema,
  maxChars = DEFAULT_SCHEMA_MAX_CHARS,
): SchemaForLlmResult {
  const attempts: SlimSchemaOptions[] = [
    {},
    { omitIndexes: true, omitRowCounts: true },
    { omitIndexes: true, omitRowCounts: true, omitComments: true },
    {
      omitIndexes: true,
      omitRowCounts: true,
      omitComments: true,
      omitRiskyFields: true,
    },
  ];

  for (const opts of attempts) {
    const slimmed =
      Object.keys(opts).length === 0 ? schema : slimSchema(schema, opts);
    const json = fits(slimmed, maxChars);
    if (json) {
      return { json, compacted: Object.keys(opts).length > 0 };
    }
  }

  const lastOpts = attempts[attempts.length - 1];
  const capped = slimWithTableCap(schema, maxChars, lastOpts);
  if (capped) {
    const allTables = Object.keys(schema.tables).sort();
    const included = new Set(Object.keys(capped.schema.tables));
    const omittedTables = allTables.filter((name) => !included.has(name));
    return {
      json: capped.json,
      compacted: true,
      omittedTables: omittedTables.length > 0 ? omittedTables : undefined,
    };
  }

  const fallback = slimSchema(schema, { ...lastOpts, maxTables: 1 });
  const allTables = Object.keys(schema.tables).sort();
  return {
    json: serializeSchema(fallback),
    compacted: true,
    omittedTables: allTables.length > 1 ? allTables.slice(1) : undefined,
  };
}
