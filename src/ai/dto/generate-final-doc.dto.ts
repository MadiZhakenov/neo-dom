/**
 * @file src/ai/dto/generate-final-doc.dto.ts
 * @description DTO для запроса на финальную генерацию документа.
 * Устарел и не используется в текущей логике, но может быть использован в будущем.
 * @deprecated
 */

import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateFinalDocDto {
  /**
   * Имя файла шаблона.
   */
  @IsString()
  @IsNotEmpty()
  templateName: string;

  /**
   * Ответы пользователя на вопросы, собранные в одну строку.
   */
  @IsString()
  @IsNotEmpty()
  userAnswersPrompt: string;
}