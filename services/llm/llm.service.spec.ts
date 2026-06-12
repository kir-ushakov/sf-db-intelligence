import { BadGatewayException } from '@nestjs/common';
import { DEFAULT_DB_INTELLIGENCE_CONFIG } from '../../db-intelligence.config';
import type { OpenAiConfig } from '../../openai.config';
import { LlmService } from './llm.service';

const mockCreate = jest.fn();
const mockParse = jest.fn();
const openAIConstructor = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation((opts: unknown) => {
    openAIConstructor(opts);
    return {
      chat: { completions: { create: mockCreate, parse: mockParse } },
    };
  }),
}));

const defaultOpenAi: OpenAiConfig = {
  apiKey: 'test-key',
  model: 'gpt-4o-mini',
};

describe('LlmService', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockParse.mockReset();
    openAIConstructor.mockReset();
  });

  it('defaults the model to gpt-4o-mini', () => {
    const service = new LlmService(DEFAULT_DB_INTELLIGENCE_CONFIG, defaultOpenAi);

    expect(service.model).toBe('gpt-4o-mini');
    expect(openAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        timeout: DEFAULT_DB_INTELLIGENCE_CONFIG.llm.timeoutMs,
        maxRetries: DEFAULT_DB_INTELLIGENCE_CONFIG.llm.maxRetries,
      }),
    );
  });

  it('honours configured model and module llm config', () => {
    const service = new LlmService(
      {
        llm: {
          ...DEFAULT_DB_INTELLIGENCE_CONFIG.llm,
          timeoutMs: 15_000,
          maxRetries: 5,
        },
      },
      { ...defaultOpenAi, model: 'gpt-4o' },
    );

    expect(service.model).toBe('gpt-4o');
    expect(openAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'test-key',
        timeout: 15_000,
        maxRetries: 5,
      }),
    );
  });

  it('injects the configured model into chat completion requests', async () => {
    mockCreate.mockResolvedValue({ choices: [] });

    const service = new LlmService(DEFAULT_DB_INTELLIGENCE_CONFIG, {
      ...defaultOpenAi,
      model: 'gpt-4o',
    });
    await service.createChatCompletion({ messages: [] });

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', messages: [] }),
    );
  });

  it('injects the configured model into parsed chat completion requests', async () => {
    mockParse.mockResolvedValue({ choices: [] });

    const service = new LlmService(DEFAULT_DB_INTELLIGENCE_CONFIG, {
      ...defaultOpenAi,
      model: 'gpt-4o',
    });
    await service.parseChatCompletion({ messages: [] });

    expect(mockParse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o', messages: [] }),
    );
  });

  it('maps OpenAI timeouts to BadGatewayException', async () => {
    mockCreate.mockRejectedValue(
      Object.assign(new Error('timed out'), {
        name: 'APIConnectionTimeoutError',
      }),
    );

    const service = new LlmService(DEFAULT_DB_INTELLIGENCE_CONFIG, defaultOpenAi);

    await expect(
      service.createChatCompletion({ messages: [] }),
    ).rejects.toBeInstanceOf(BadGatewayException);
  });
});
