/**
 * Public API of the db-intelligence package.
 *
 * Minimal surface for a self-contained Nest module: wiring (`forRoot`), HTTP
 * contract types, and nothing else. Services, schema types, config resolvers,
 * and DI tokens stay internal.
 *
 * Overview: docs/README.md
 */
export { DbIntelligenceModule } from './db-intelligence.module';

export type { DbIntelligenceConfigInput } from './db-intelligence.config';

export { TextToSqlRequestDto } from './features/text-to-sql/text-to-sql.dto';
export type { TextToSqlResult } from './features/text-to-sql/text-to-sql.types';
