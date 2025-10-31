// src\mail\mail.service.ts

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MailService {
  private readonly backendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const backendUrlValue = this.configService.get<string>('BACKEND_URL');
  
    if (!backendUrlValue) {
      throw new Error('Ключевая переменная BACKEND_URL (.env) не определена!');
    }
    this.backendUrl = backendUrlValue;
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    const resetLink = `${this.backendUrl}/auth/reset-password?token=${token}`;
    console.log('--- MOCK EMAIL SENDER ---');
    console.log(`To: ${to}`);
    console.log(`Subject: Восстановление пароля для NeoOSI`);
    console.log(`Link: ${resetLink}`);
    console.log('-------------------------');
  }
}