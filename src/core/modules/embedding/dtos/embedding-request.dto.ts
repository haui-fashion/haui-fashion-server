import { IsArray, IsBoolean, IsOptional, IsString } from 'class-validator';

export class EmbeddingRequest {
  @IsString({ each: true })
  @IsArray()
  texts: string[];

  @IsBoolean()
  @IsOptional()
  normalize?: boolean;
}
