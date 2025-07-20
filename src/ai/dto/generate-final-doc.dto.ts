// src/ai/dto/generate-final-doc.dto.ts
import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class GenerateFinalDocDto {
  @IsString()
  @IsNotEmpty()
  templateName: string;

  @IsString() 
  @IsNotEmpty()
  userAnswersPrompt: string; 
}