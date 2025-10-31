/**
 * @file src/ai/dto/generate-document.dto.ts
 * @description DTO для основного запроса в чат AI.
 */

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateDocumentDto {

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}