import { Test, TestingModule } from '@nestjs/testing';
import { TextToSqlController } from './text-to-sql.controller';
import { TextToSqlService } from './text-to-sql.service';

describe('TextToSqlController', () => {
  let controller: TextToSqlController;
  const query = jest.fn();

  beforeEach(async () => {
    query.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TextToSqlController],
      providers: [
        {
          provide: TextToSqlService,
          useValue: { query },
        },
      ],
    }).compile();

    controller = module.get(TextToSqlController);
  });

  it('passes question from body to the service', async () => {
    query.mockResolvedValue({ question: 'orders', sql: '', params: [], rows: [] });

    await controller.query({ question: 'orders' });

    expect(query).toHaveBeenCalledWith('orders');
  });
});
