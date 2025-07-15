// src/ai/ai.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService implements OnModuleInit {
  private model: any;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    console.log('AI модуль инициализируется...');
    
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY не найден в .env файле!');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Используем ту же модель, что и в тесте
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    
    console.log('Модель Gemini успешно инициализирована.');
  }


  async generateText(prompt: string): Promise<string> {
    try {
      console.log(`Отправка промпта в Gemini: "${prompt}"`);
      
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      const text = response.text();
      
      console.log('Получен ответ от Gemini.');
      return text;

    } catch (error) {
      console.error('Ошибка при генерации текста в AiService:', error);
      throw new Error('Не удалось сгенерировать ответ от AI.');
    }
  }
}