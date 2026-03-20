import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class SyncProductEmbeddingDto {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  force?: boolean;
}
