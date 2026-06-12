/**
 * Typed MySQL connection and pool settings for db-intelligence.
 *
 * Self-contained: env parsing (`mysqlEnvSchema` + `resolveMysqlConfig`) lives in
 * the module so it carries no dependency on the host app's config. Values come
 * from `MYSQL_*` env merged with `DbIntelligenceModule.forRoot({ mysql })`
 * overrides. Secrets stay in env; pool tuning has explicit defaults.
 *
 * Overview: docs/README.md
 */
import { z } from 'zod';
import type { PoolOptions } from 'mysql2/promise';
import { parseBoolean, parseNonNegativeInt, parsePort } from './env-parsers';

export const MYSQL_CONFIG_KEY = 'mysql';

export const mysqlEnvSchema = z.object({
  MYSQL_HOST: z.string().optional(),
  MYSQL_PORT: z.string().optional(),
  MYSQL_USER: z.string().optional(),
  MYSQL_PASSWORD: z.string().optional(),
  MYSQL_DATABASE: z.string().optional(),
  MYSQL_CONNECTION_LIMIT: z.string().optional(),
  MYSQL_WAIT_FOR_CONNECTIONS: z.string().optional(),
  MYSQL_QUEUE_LIMIT: z.string().optional(),
  MYSQL_TIMEZONE: z.string().optional(),
});

export type MysqlConfig = Required<
  Pick<
    PoolOptions,
    | 'host'
    | 'port'
    | 'user'
    | 'password'
    | 'database'
    | 'connectionLimit'
    | 'waitForConnections'
    | 'queueLimit'
    | 'timezone'
  >
>;

export const DEFAULT_MYSQL_CONFIG: MysqlConfig = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'classicmodels',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
  timezone: 'Z',
};

export function resolveMysqlConfig(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<MysqlConfig> = {},
): MysqlConfig {
  const parsed = mysqlEnvSchema.parse(env);
  return {
    host: parsed.MYSQL_HOST ?? DEFAULT_MYSQL_CONFIG.host,
    port: parsePort(parsed.MYSQL_PORT, DEFAULT_MYSQL_CONFIG.port),
    user: parsed.MYSQL_USER ?? DEFAULT_MYSQL_CONFIG.user,
    password: parsed.MYSQL_PASSWORD ?? DEFAULT_MYSQL_CONFIG.password,
    database: parsed.MYSQL_DATABASE ?? DEFAULT_MYSQL_CONFIG.database,
    connectionLimit: parseNonNegativeInt(
      parsed.MYSQL_CONNECTION_LIMIT,
      DEFAULT_MYSQL_CONFIG.connectionLimit,
    ),
    waitForConnections: parseBoolean(
      parsed.MYSQL_WAIT_FOR_CONNECTIONS,
      DEFAULT_MYSQL_CONFIG.waitForConnections,
    ),
    queueLimit: parseNonNegativeInt(
      parsed.MYSQL_QUEUE_LIMIT,
      DEFAULT_MYSQL_CONFIG.queueLimit,
    ),
    timezone: parsed.MYSQL_TIMEZONE ?? DEFAULT_MYSQL_CONFIG.timezone,
    ...overrides,
  };
}
