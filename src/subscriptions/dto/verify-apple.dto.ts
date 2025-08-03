// src\subscriptions\dto\verify-apple.dto.ts

import { IsString, IsNotEmpty } from 'class-validator';

export class VerifyAppleDto {
  @IsString()
  @IsNotEmpty()
  receipt: string;
}