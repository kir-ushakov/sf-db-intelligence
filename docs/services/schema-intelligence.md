# Schema intelligence service

Internal service (`SchemaIntelligenceService`) that reads `INFORMATION_SCHEMA`, builds a
typed `DatabaseSchema` snapshot, and runs guarded read-only SQL.

- **Code:** `services/schema-intelligence/`
- **Connection:** `mysql.config.ts` + `mysql-pool.provider.ts` (module root) — typed env resolved in `forRoot` (`resolveMysqlConfig`), injected `Pool` and database name
- **Types:** `types/schema.types.ts` (snapshot interfaces), `types/raw-rows.types.ts` (raw INFORMATION_SCHEMA row shapes), `types/field-category.enum.ts`
- **Classifiers:** `helpers/classify-column.function.ts`, `helpers/classify-select-risk.ts`, `helpers/effective-char-max-length.function.ts`
- **Assembly:** `helpers/build-field.function.ts`, `helpers/build-foreign-keys.function.ts`, `helpers/build-indexes.function.ts`, `helpers/assemble-database-schema.ts` (pure; the service only fetches rows and delegates)
- **Guard:** `helpers/read-only-sql-guard.function.ts`

Type files carry a short JSDoc header that points here; this doc is the canonical reference for fields and mappings (see `docs/README.md` § Documentation conventions).

## Types (`schema.types.ts`)

| Export | Role |
| --- | --- |
| `DatabaseSchema` | Root snapshot: `database`, `tables`, `foreign_keys` |
| `SchemaTable` | One table: `approx_row_count` (estimate), `fields`, `indexes`, optional `comment` |
| `SchemaField` | One column; see [Enriched `SchemaField` metadata](#enriched-schemafield-metadata) |
| `SchemaIndex` | One index: `name`, ordered `columns[]`, `unique` from `NON_UNIQUE` |
| `SchemaForeignKey` | One FK constraint with `from` / `to` column lists (ordinal order preserved) |
| `SchemaForeignKeySide` | `table` + `columns[]` on one end of an FK |
| `SelectRisk` | `'safe' \| 'risky'` on each field; see [`select_risk`](#select_risk) |
| `FieldCategory` | Column storage class; see [`category`](#category-fieldcategory) |

## Snapshot shape

`getDatabaseSchema()` returns:

```jsonc
{
  "database": "classicmodels",
  "tables": {
    "orders": {
      "approx_row_count": 326,
      "comment": "…",           // optional, from TABLE_COMMENT
      "fields": { "orderNumber": { /* SchemaField */ } },
      "indexes": [{ "name": "PRIMARY", "columns": ["orderNumber"], "unique": true }]
    }
  },
  "foreign_keys": [/* … */]
}
```

Raw MySQL metadata is kept where the LLM needs it (`type` = full `COLUMN_TYPE`,
`data_type` = `DATA_TYPE`). Extra fields on each `SchemaField` are computed so consumers
do not re-parse MySQL type strings.

## Enriched `SchemaField` metadata

| Field | Type | Source | Purpose |
| --- | --- | --- | --- |
| `type` | string | `COLUMN_TYPE` | Exact MySQL type for SQL generation |
| `data_type` | string | `DATA_TYPE` | Input to `classifyColumn` |
| `category` | `FieldCategory` | `classifyColumn(data_type)` | Coarse storage class for prompts |
| `select_risk` | `'safe' \| 'risky'` | `classifySelectRisk(category, max_length)` | Hint for large/opaque SELECT payloads |
| `max_length` | number (optional) | `effectiveCharMaxLength` | Char length cap when known or inferable |
| `nullable` | boolean | `IS_NULLABLE` | Whether the column allows NULL |
| `primary_key` | boolean (optional) | `COLUMN_KEY === 'PRI'` | Present only when true |
| `default` | string \| null (optional) | `COLUMN_DEFAULT` | Omitted when not set in MySQL |
| `comment` | string (optional) | `COLUMN_COMMENT` | Business meaning for the LLM |

### `SchemaTable` and indexes

- `approx_row_count` comes from `INFORMATION_SCHEMA.TABLES.TABLE_ROWS` — an estimate, not an exact count (often wrong by orders of magnitude for InnoDB).
- `indexes` lists one entry per index (multi-column indexes keep ordered `columns[]` and `name`).
- Table `comment` is included when `TABLE_COMMENT` is non-empty.

### Foreign keys

`foreign_keys` aggregates `KEY_COLUMN_USAGE` rows by constraint name. Each entry lists
ordered columns on the local and referenced sides. FKs whose local table is missing from
the snapshot are skipped.

### `category` (`FieldCategory`)

Storage-class bucket derived from **`DATA_TYPE` only**, not from the full `COLUMN_TYPE`
(e.g. `varchar(255)` and `int` are both classified from `varchar` / `int`).

| `FieldCategory` | When assigned (`DATA_TYPE`) |
| --- | --- |
| `binary` | `binary`, `varbinary`, `blob`, `tinyblob`, `mediumblob`, `longblob` |
| `json` | `json` |
| `text` | `tinytext`, `text`, `mediumtext`, `longtext` |
| `scalar` | everything else (`int`, `varchar`, `decimal`, `datetime`, `enum`, …) |

Implementation: `helpers/classify-column.function.ts`. Enum definition:
`types/field-category.enum.ts`.

### `select_risk`

Marks columns that are expensive or opaque to pull into a result set or LLM context.

| Result | Condition |
| --- | --- |
| `risky` | `category` is `text`, `json`, or `binary` |
| `risky` | `category` is `scalar` and `max_length` &gt; 500 (`RISKY_CHAR_MAX_LENGTH`) |
| `safe` | otherwise |

Implementation: `helpers/classify-select-risk.ts`.

**Note:** `select_risk` is a hint for schema serialization and prompting, not a SQL
blocklist. Execution safety is handled separately by `executeReadOnlyQuery`.

### `max_length`

- Taken from `CHARACTER_MAXIMUM_LENGTH` when MySQL provides it.
- For `tinytext` / `text` / `mediumtext` / `longtext`, filled from known upper bounds
  when `CHARACTER_MAXIMUM_LENGTH` is null (see `effective-char-max-length.function.ts`).
- Omitted on the field when no length can be determined (e.g. many non-char types).

Used together with `category` for `select_risk` on wide `varchar`/`char` columns.

## LLM serialization

`formatSchemaForLlm` (`helpers/schema-for-llm.ts`) may drop `select_risk: 'risky'` fields
when `omitRiskyFields` is enabled during schema compaction. Text-to-SQL calls this before
embedding the schema in the prompt.

## Read-only execution

`executeReadOnlyQuery(sql, params)` — `SELECT` / `WITH` only, no semicolons. All module SQL
execution goes through this method. `findReadOnlySqlViolation` returns an error message or
`null` (the service maps violations to a 400).

**Security boundary:** run the module against a MySQL user with `SELECT` grants only on the
target schema. The app guard is fast-fail hygiene, not a substitute for database permissions.
