/**
 * Nest DI tokens and pool factory for db-intelligence MySQL access.
 *
 * Resolved settings come from `mysql.config.ts` (`resolveMysqlConfig`, wired in
 * `DbIntelligenceModule.forRoot`); this file only binds a typed config object to
 * a `mysql2` pool so services inject `MYSQL_POOL` / `MYSQL_DATABASE` instead of
 * reading env.
 *
 * Overview: docs/README.md
 */
import * as mysql from 'mysql2/promise';
import type { Pool } from 'mysql2/promise';
import type { MysqlConfig } from './mysql.config';

export const MYSQL_POOL = Symbol('MYSQL_POOL');
export const MYSQL_DATABASE = Symbol('MYSQL_DATABASE');

export function createMysqlPool(config: MysqlConfig): Pool {
  return mysql.createPool(config);
}
