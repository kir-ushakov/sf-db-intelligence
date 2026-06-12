import {
  BadGatewayException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  DB_INTELLIGENCE_CONFIG,
  DEFAULT_DB_INTELLIGENCE_CONFIG,
} from '../../db-intelligence.config';
import { TextToSqlService } from './text-to-sql.service';
import { LlmService } from '../../services/llm/llm.service';
import { SchemaIntelligenceService } from '../../services/schema-intelligence/schema-intelligence.service';

const mockParse = jest.fn();

describe('TextToSqlService', () => {
  let service: TextToSqlService;

  const schemaSnapshot = {
    database: 'classicmodels',
    tables: {
      orders: {
        approx_row_count: 326,
        indexes: [],
        fields: {
          status: {
            type: 'varchar(15)',
            data_type: 'varchar',
            category: 'scalar',
            nullable: false,
            select_risk: 'safe',
            max_length: 15,
          },
        },
      },
    },
    foreign_keys: [],
  };

  beforeEach(async () => {
    mockParse.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TextToSqlService,
        {
          provide: SchemaIntelligenceService,
          useValue: {
            getDatabaseSchema: jest.fn().mockResolvedValue(schemaSnapshot),
            executeReadOnlyQuery: jest
              .fn()
              .mockResolvedValue([{ status: 'Shipped' }]),
          },
        },
        {
          provide: LlmService,
          useValue: {
            model: 'gpt-4o-mini',
            parseChatCompletion: mockParse,
          },
        },
        {
          provide: DB_INTELLIGENCE_CONFIG,
          useValue: DEFAULT_DB_INTELLIGENCE_CONFIG,
        },
      ],
    }).compile();

    service = module.get(TextToSqlService);
  });

  it('generates SQL JSON and returns rows', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          message: {
            parsed: {
              sql: 'SELECT status FROM orders WHERE status = ?',
              params: ['Shipped'],
            },
          },
        },
      ],
    });

    await expect(service.query('покажи оплаченные заказы')).resolves.toEqual(
      expect.objectContaining({
        question: 'покажи оплаченные заказы',
        sql: expect.stringContaining('SELECT status FROM orders'),
        params: ['Shipped'],
        rows: [{ status: 'Shipped' }],
      }),
    );

    expect(mockParse).toHaveBeenCalledWith(
      expect.objectContaining({
        temperature: 0,
        max_completion_tokens: 1024,
      }),
    );
  });

  it('throws BadGateway when the model returns unparseable content', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: 'Here is the query: SELECT 1',
            parsed: null,
          },
        },
      ],
    });

    await expect(service.query('что угодно')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('throws BadGateway when the response is truncated', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          finish_reason: 'length',
          message: {
            content: '{"sql":"SELECT status FROM orders',
            parsed: null,
          },
        },
      ],
    });

    await expect(service.query('что угодно')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it('throws BadGateway when parsed output fails schema validation', async () => {
    mockParse.mockResolvedValue({
      choices: [
        {
          finish_reason: 'stop',
          message: {
            content: JSON.stringify({ params: [] }),
            parsed: null,
          },
        },
      ],
    });

    await expect(service.query('что угодно')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });
});
