import { Body, Controller, Post } from '@nestjs/common';
import { TextToSqlRequestDto } from './text-to-sql.dto';
import { TextToSqlService } from './text-to-sql.service';
import type { TextToSqlResult } from './text-to-sql.types';

@Controller('text-to-sql')
export class TextToSqlController {
  constructor(private readonly textToSqlService: TextToSqlService) {}

  @Post()
  async query(@Body() body: TextToSqlRequestDto): Promise<TextToSqlResult> {
    return this.textToSqlService.query(body.question);
  }
}
