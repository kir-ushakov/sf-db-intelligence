/**
 * Nest entry point for db-intelligence: registers HTTP features, internal services,
 * and shared providers (`DB_INTELLIGENCE_CONFIG`, `OPENAI_CONFIG`, `MYSQL_POOL`,
 * `MYSQL_DATABASE`).
 *
 * `forRoot` resolves all config eagerly from `process.env` merged with the passed
 * overrides, so the module is self-contained and does not depend on the host app's
 * `ConfigModule` loading order. Import `DbIntelligenceModule.forRoot({ … })` from
 * the app module. Features depend on services only; services must not import from
 * `features/`.
 *
 * Overview: docs/README.md
 */
import { DynamicModule, Module } from '@nestjs/common';
import { LlmService } from './services/llm/llm.service';
import { TextToSqlController } from './features/text-to-sql/text-to-sql.controller';
import { TextToSqlService } from './features/text-to-sql/text-to-sql.service';
import { SchemaIntelligenceService } from './services/schema-intelligence/schema-intelligence.service';
import {
  DB_INTELLIGENCE_CONFIG,
  DbIntelligenceConfigInput,
  resolveDbIntelligenceConfig,
} from './db-intelligence.config';
import { resolveMysqlConfig } from './mysql.config';
import { OPENAI_CONFIG, resolveOpenAiConfig } from './openai.config';
import {
  MYSQL_DATABASE,
  MYSQL_POOL,
  createMysqlPool,
} from './mysql-pool.provider';

const MODULE_PROVIDERS = [
  LlmService,
  SchemaIntelligenceService,
  TextToSqlService,
] as const;

const MODULE_CONTROLLERS = [TextToSqlController] as const;

@Module({})
export class DbIntelligenceModule {
  static forRoot(config?: DbIntelligenceConfigInput): DynamicModule {
    const mysql = resolveMysqlConfig(process.env, config?.mysql);
    const openai = resolveOpenAiConfig(process.env, config?.openai);

    return {
      module: DbIntelligenceModule,
      controllers: [...MODULE_CONTROLLERS],
      providers: [
        {
          provide: DB_INTELLIGENCE_CONFIG,
          useValue: resolveDbIntelligenceConfig(config),
        },
        {
          provide: OPENAI_CONFIG,
          useValue: openai,
        },
        {
          provide: MYSQL_DATABASE,
          useValue: mysql.database,
        },
        {
          provide: MYSQL_POOL,
          useFactory: () => createMysqlPool(mysql),
        },
        ...MODULE_PROVIDERS,
      ],
      exports: [DB_INTELLIGENCE_CONFIG, OPENAI_CONFIG, ...MODULE_PROVIDERS],
    };
  }
}
