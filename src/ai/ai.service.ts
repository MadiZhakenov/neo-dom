import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AiService implements OnModuleInit {
  // Инициализированная модель Gemini
  private model: any;

  // PDF-файлы из базы знаний в формате, подходящем для Gemini (base64)
  private knowledgeBaseFiles: any[] = [];

  constructor(private readonly configService: ConfigService) {}

  /**
   * Инициализация AI-модуля при старте приложения:
   * - получает API-ключ,
   * - инициализирует модель Gemini,
   * - загружает PDF-файлы из базы знаний в память.
   */
  onModuleInit() {
    console.log('[AI Service] Модуль инициализируется...');

    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY не найден в .env файле!');
    }

    const genAI = new GoogleGenerativeAI(apiKey);

    // Используем модель, которая поддерживает работу с файлами
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });

    console.log('[AI Service] Модель Gemini успешно инициализирована.');
    this.loadKnowledgeBase();
  }

  /**
   * Загружает все PDF-файлы из папки `knowledge_base`, конвертирует их в base64
   * и сохраняет в массиве, чтобы использовать при генерации контекста для AI.
   */
  private loadKnowledgeBase() {
    console.log('[AI Service] Загрузка базы знаний в память...');
    try {
      const knowledgeBaseDir = path.join(process.cwd(), 'knowledge_base');
      const fileNames = fs.readdirSync(knowledgeBaseDir);
      const pdfFiles = fileNames.filter(f => f.toLowerCase().endsWith('.pdf'));

      for (const fileName of pdfFiles) {
        const filePath = path.join(knowledgeBaseDir, fileName);
        const fileData = fs.readFileSync(filePath);
        const base64Data = fileData.toString('base64');

        // Структура, которую принимает Gemini в parts[]
        this.knowledgeBaseFiles.push({
          inlineData: {
            data: base64Data,
            mimeType: 'application/pdf',
          },
        });
      }

      console.log(`[AI Service] База знаний загружена. ${this.knowledgeBaseFiles.length} файлов готово к использованию.`);
    } catch (error) {
      console.error('[AI Service] КРИТИЧЕСКАЯ ОШИБКА: Не удалось загрузить файлы из базы знаний. Проверьте папку knowledge_base.', error);
    }
  }

  /**
   * Основной метод генерации ответа от AI.
   * Подключает все загруженные PDF-файлы как контекст и отправляет промпт пользователю.
   *
   * @param userPrompt - Запрос пользователя
   * @returns - Ответ, сгенерированный моделью Gemini
   */
  async generateText(userPrompt: string): Promise<string> {
    if (this.knowledgeBaseFiles.length === 0) {
      console.warn('[AI Service] База знаний пуста. Ответ будет сгенерирован без дополнительного контекста.');
    }

    try {
      console.log(`[AI Service] Отправка промпта в Gemini с контекстом из ${this.knowledgeBaseFiles.length} файлов...`);

      // parts[] может содержать как текст, так и файлы — в правильной последовательности
      const fullPromptParts = [
        ...this.knowledgeBaseFiles,
        {
          text: "Ты — помощник по вопросам управления ОСИ в Казахстане. Отвечай строго на основе предоставленных документов (стандарты СТ РК). Если в документах нет ответа на вопрос, вежливо сообщи об этом и не придумывай информацию."
        },
        { text: userPrompt },
      ];

      const result = await this.model.generateContent({
        contents: [{ role: "user", parts: fullPromptParts }]
      });

      const response = result.response;
      const text = response.text();

      console.log('[AI Service] Получен ответ от Gemini.');
      return text;
    } catch (error) {
      console.error('[AI Service] Ошибка при генерации текста:', error);
      throw new Error('Не удалось сгенерировать ответ от AI.');
    }
  }
}
