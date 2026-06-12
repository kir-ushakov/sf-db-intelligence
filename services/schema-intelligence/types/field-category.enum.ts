/**
 * Coarse MySQL storage class for a column in the schema snapshot.
 *
 * Values come from INFORMATION_SCHEMA `DATA_TYPE` via `classifyColumn`, not from the
 * full `COLUMN_TYPE` string. Each {@link SchemaField} includes `category` so prompts
 * and serializers can judge payload shape without parsing MySQL type syntax.
 *
 * TEXT, JSON, and BINARY usually imply large or opaque SELECT payloads; that feeds
 * `select_risk` in `classifySelectRisk`. SCALAR is everything else (ints, decimals,
 * varchar, datetime, etc.).
 *
 * Field-level detail: docs/services/schema-intelligence.md
 */
export enum FieldCategory {
  SCALAR = 'scalar',
  TEXT = 'text',
  JSON = 'json',
  BINARY = 'binary',
}
