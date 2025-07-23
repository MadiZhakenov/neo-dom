/**
 * @file src/ai/dto/generate-document.dto.ts
 * @description DTO для основного запроса в чат AI.
 */

import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateDocumentDto {
  /**
   * Текстовое сообщение (промпт) от пользователя.
   * @example "Помоги мне оформить акт"
   */
  @IsString()
  @IsNotEmpty()
  prompt: string;

  /**
   * Уникальный идентификатор сессии генерации документа (опционально).
   */
  @IsString()
  @IsOptional()
  requestId?: string;
}