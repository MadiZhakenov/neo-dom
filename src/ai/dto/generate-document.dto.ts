// src/ai/dto/generate-document.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';

export class GenerateDocumentDto {
  @IsString()
  @IsNotEmpty()
  prompt: string;
}