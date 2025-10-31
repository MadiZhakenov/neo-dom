import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class GenerateDocumentDto {

  @IsString()
  @IsNotEmpty()
  prompt: string;

  @IsString()
  @IsOptional()
  requestId?: string;
}