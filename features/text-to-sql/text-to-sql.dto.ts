import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class TextToSqlRequestDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  question!: string;
}
