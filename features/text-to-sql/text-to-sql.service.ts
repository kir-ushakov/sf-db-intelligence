/**
 * Orchestrates natural-language → SQL: loads a budget-bounded schema snapshot,
 * asks the LLM for a parameterised plan, enforces a row limit, then runs the
 * query through the read-only guard.
 *
 * Error semantics: upstream/model faults (truncated, empty, malformed JSON)
 * surface as 502; misconfiguration and unexpected failures as 500.
 *
 * Behaviour and testing: docs/features/text-to-sql.md
 */
import {
  BadGatewayException,
  HttpException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { zodResponseFormat } from 'openai/helpers/zod';
import type { ParsedChatCompletion } from 'openai/resources/chat/completions';
import { DB_INTELLIGENCE_CONFIG } from '../../db-intelligence.config';
import type { DbIntelligenceConfig } from '../../db-intelligence.config';
import { LlmService } from '../../services/llm/llm.service';
import { SchemaIntelligenceService } from '../../services/schema-intelligence/schema-intelligence.service';
import { formatSchemaForLlm } from '../../services/schema-intelligence/helpers/schema-for-llm';
import { applyRowLimit } from './helpers/apply-row-limit.function';
import { sqlPlanSchema, type SqlPlan } from './contracts/sql-plan.schema';
import { buildSqlSystemPrompt, buildSqlUserPrompt } from './text-to-sql.prompt';
import { SqlQuery, TextToSqlResult } from './text-to-sql.types';

@Injectable()
export class TextToSqlService {
  private readonly logger = new Logger(TextToSqlService.name);

  constructor(
    private readonly schemaIntelligenceService: SchemaIntelligenceService,
    private readonly llm: LlmService,
    @Inject(DB_INTELLIGENCE_CONFIG)
    private readonly config: DbIntelligenceConfig,
  ) {}

  async query(question: string): Promise<TextToSqlResult> {
    const schemaJson = await this.loadSchemaForPrompt();

    try {
      const completion = await this.requestSqlPlan(question, schemaJson);
      const plan = this.extractSqlPlan(completion);
      const { sql, limit } = applyRowLimit(plan.sql, {
        fallback: this.config.llm.sqlRowDefault,
        max: this.config.llm.sqlRowMax,
      });
      const rows = await this.schemaIntelligenceService.executeReadOnlyQuery(
        sql,
        plan.params,
      );

      return {
        question,
        sql,
        params: plan.params,
        rows,
        rowLimit: limit,
        truncated: rows.length >= limit,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('AI SQL query failed', error);
      throw new InternalServerErrorException('Failed to generate/execute SQL');
    }
  }

  /** Loads the schema snapshot and serialises it to a budget-bounded JSON string. */
  private async loadSchemaForPrompt(): Promise<string> {
    const schema = await this.schemaIntelligenceService.getDatabaseSchema();
    const { json, compacted, omittedTables } = formatSchemaForLlm(
      schema,
      this.config.llm.schemaMaxChars,
    );
    if (compacted) {
      this.logger.warn(
        `Schema JSON compacted for LLM (chars=${json.length}${
          omittedTables?.length
            ? `, omitted_tables=${omittedTables.join(',')}`
            : ''
        })`,
      );
    }
    return json;
  }

  private requestSqlPlan(
    question: string,
    schemaJson: string,
  ): Promise<ParsedChatCompletion<SqlPlan>> {
    return this.llm.parseChatCompletion<SqlPlan>({
      temperature: this.config.llm.sqlTemperature,
      max_completion_tokens: this.config.llm.sqlMaxTokens,
      response_format: zodResponseFormat(sqlPlanSchema, 'sql_plan'),
      messages: [
        {
          role: 'system',
          content: buildSqlSystemPrompt({
            rowDefault: this.config.llm.sqlRowDefault,
            rowMax: this.config.llm.sqlRowMax,
          }),
        },
        { role: 'user', content: buildSqlUserPrompt(question, schemaJson) },
      ],
    });
  }

  /**
   * Inspects the untrusted completion and narrows it to a {@link SqlQuery}.
   * Truncation, empty content, and malformed JSON are upstream faults → 502.
   */
  private extractSqlPlan(completion: ParsedChatCompletion<SqlPlan>): SqlQuery {
    const choice = completion.choices[0];
    const finishReason = choice?.finish_reason;
    const message = choice?.message;
    const raw = message?.content?.trim();

    if (finishReason === 'length') {
      this.logger.warn(
        `AI response truncated (model=${this.llm.model}, len=${raw?.length ?? 0})`,
      );
      throw new BadGatewayException('The model response was truncated');
    }

    const parsed = message?.parsed;
    if (!parsed) {
      this.logger.warn(
        `AI returned unparseable content (model=${this.llm.model}, finish=${finishReason}, refusal=${
          message?.refusal ?? 'none'
        })${raw ? ` | raw="${raw.slice(0, 500)}"` : ''}`,
      );
      throw new BadGatewayException('The model returned an invalid response');
    }

    return parsed;
  }
}
