import {
  BadGatewayException,
  Inject,
  Injectable,
} from '@nestjs/common';
import OpenAI from 'openai';
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ParsedChatCompletion,
} from 'openai/resources/chat/completions';
import { OPENAI_CONFIG } from '../../openai.config';
import type { OpenAiConfig } from '../../openai.config';
import { DB_INTELLIGENCE_CONFIG } from '../../db-intelligence.config';
import type { DbIntelligenceConfig } from '../../db-intelligence.config';

/** Chat completion params; `model` is injected by {@link LlmService}. */
export type LlmChatRequest = Omit<ChatCompletionCreateParamsNonStreaming, 'model'>;

function isOpenAiTimeout(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { name?: string; code?: string };
  return (
    candidate.name === 'APIConnectionTimeoutError' ||
    candidate.code === 'ETIMEDOUT' ||
    candidate.code === 'ECONNABORTED'
  );
}

@Injectable()
export class LlmService {
  private readonly client: OpenAI;
  readonly model: string;

  constructor(
    @Inject(DB_INTELLIGENCE_CONFIG)
    private readonly config: DbIntelligenceConfig,
    @Inject(OPENAI_CONFIG)
    openai: OpenAiConfig,
  ) {
    this.model = openai.model;
    this.client = new OpenAI({
      apiKey: openai.apiKey,
      timeout: this.config.llm.timeoutMs,
      maxRetries: this.config.llm.maxRetries,
    });
  }

  async createChatCompletion(request: LlmChatRequest): Promise<ChatCompletion> {
    return this.runChatCompletion((client) =>
      client.chat.completions.create({
        model: this.model,
        ...request,
      }),
    );
  }

  async parseChatCompletion<T = unknown>(
    request: LlmChatRequest,
  ): Promise<ParsedChatCompletion<T>> {
    return this.runChatCompletion((client) =>
      client.chat.completions.parse({
        model: this.model,
        ...request,
      }),
    );
  }

  private async runChatCompletion<T>(
    call: (client: OpenAI) => Promise<T>,
  ): Promise<T> {
    try {
      return await call(this.client);
    } catch (error) {
      if (isOpenAiTimeout(error)) {
        throw new BadGatewayException('The language model request timed out');
      }
      throw error;
    }
  }
}
