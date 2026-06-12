/**
 * Reads INFORMATION_SCHEMA to build a typed `DatabaseSchema` snapshot and runs
 * guarded read-only SQL. This is the only place module SQL executes:
 * `executeReadOnlyQuery` rejects anything but a single-statement SELECT/WITH
 * (BadRequestException → 400).
 *
 * The service is a thin orchestrator: it fetches raw rows from an injected pool
 * and delegates all transformation and validation to pure `helpers/`
 * (`assemble-database-schema`, `read-only-sql-guard.function`).
 *
 * Behaviour and testing: docs/services/schema-intelligence.md
 */
import {
  BadRequestException,
  Inject,
  Injectable,
  OnModuleDestroy,
} from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import type { Pool } from 'mysql2/promise';
import { MYSQL_DATABASE, MYSQL_POOL } from '../../mysql-pool.provider';
import { DatabaseSchema } from './types/schema.types';
import {
  ColumnRow,
  ForeignKeyRow,
  IndexRow,
  TableRow,
} from './types/raw-rows.types';
import { assembleDatabaseSchema } from './helpers/assemble-database-schema';
import { findReadOnlySqlViolation } from './helpers/read-only-sql-guard.function';

type Packet<T> = T & RowDataPacket;

const TABLES_QUERY = `
  SELECT
    TABLE_NAME AS table_name,
    TABLE_ROWS AS table_rows,
    TABLE_COMMENT AS table_comment
  FROM information_schema.tables
  WHERE table_schema = ?
    AND table_type = 'BASE TABLE'
  ORDER BY TABLE_NAME
`;

const COLUMNS_QUERY = `
  SELECT
    TABLE_NAME AS table_name,
    COLUMN_NAME AS column_name,
    COLUMN_TYPE AS column_type,
    DATA_TYPE AS data_type,
    CHARACTER_MAXIMUM_LENGTH AS character_maximum_length,
    IS_NULLABLE AS is_nullable,
    COLUMN_KEY AS column_key,
    COLUMN_DEFAULT AS column_default,
    COLUMN_COMMENT AS column_comment
  FROM information_schema.columns
  WHERE table_schema = ?
  ORDER BY TABLE_NAME, ORDINAL_POSITION
`;

const INDEXES_QUERY = `
  SELECT
    TABLE_NAME AS table_name,
    INDEX_NAME AS index_name,
    COLUMN_NAME AS column_name,
    NON_UNIQUE AS non_unique
  FROM information_schema.statistics
  WHERE table_schema = ?
  ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX
`;

const FOREIGN_KEYS_QUERY = `
  SELECT
    kcu.CONSTRAINT_NAME AS constraint_name,
    kcu.TABLE_NAME AS table_name,
    kcu.COLUMN_NAME AS column_name,
    kcu.REFERENCED_TABLE_NAME AS referenced_table,
    kcu.REFERENCED_COLUMN_NAME AS referenced_column,
    kcu.ORDINAL_POSITION AS ordinal_position
  FROM information_schema.KEY_COLUMN_USAGE kcu
  WHERE kcu.TABLE_SCHEMA = ?
    AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
  ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
`;

@Injectable()
export class SchemaIntelligenceService implements OnModuleDestroy {
  constructor(
    @Inject(MYSQL_POOL) private readonly pool: Pool,
    @Inject(MYSQL_DATABASE) private readonly database: string,
  ) {}

  async onModuleDestroy() {
    await this.pool.end();
  }

  async getDatabaseSchema(): Promise<DatabaseSchema> {
    const [tables, columns, indexes, foreignKeys] = await Promise.all([
      this.fetch<TableRow>(TABLES_QUERY),
      this.fetch<ColumnRow>(COLUMNS_QUERY),
      this.fetch<IndexRow>(INDEXES_QUERY),
      this.fetch<ForeignKeyRow>(FOREIGN_KEYS_QUERY),
    ]);

    return assembleDatabaseSchema({
      database: this.database,
      tables,
      columns,
      indexes,
      foreignKeys,
    });
  }

  async executeReadOnlyQuery(
    sql: string,
    params: readonly unknown[] = [],
  ): Promise<unknown[]> {
    const violation = findReadOnlySqlViolation(sql);
    if (violation) {
      throw new BadRequestException(violation);
    }

    const [rows] = await this.pool.query(sql, params as unknown[]);
    return Array.isArray(rows) ? (rows as unknown[]) : [rows];
  }

  private async fetch<T>(query: string): Promise<T[]> {
    const [rows] = await this.pool.query<Packet<T>[]>(query, [this.database]);
    return rows;
  }
}
