import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { TaskType } from '@google/generative-ai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

@Injectable()
export class AiService implements OnModuleInit {
  private model: any;
  private vectorStore: MemoryVectorStore;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    console.log('[AI Service] Модуль инициализируется...');
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY не найден в .env файле!');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    console.log('[AI Service] Модель Gemini успешно инициализирована.');

    await this.initializeVectorStore(apiKey);
  }

  private async initializeVectorStore(apiKey: string) {
    console.log('[AI Service] Инициализация векторной базы знаний...');
    try {
      const cacheDir = path.join(process.cwd(), '.pdf-cache');
      const fileNames = fs.readdirSync(cacheDir);

      const documents = fileNames.map((fileName) => ({
        pageContent: fs.readFileSync(path.join(cacheDir, fileName), 'utf-8'),
        metadata: { source: fileName.replace('.txt', '') },
      }));

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 200,
      });

      const docs = await splitter.splitDocuments(documents);
      console.log(`[AI Service] Документы разделены на ${docs.length} смысловых чанков.`);

      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: 'embedding-001',
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });

      this.vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      console.log(`[AI Service] Векторная база знаний успешно создана.`);
    } catch (error) {
      console.error('[AI Service] Ошибка при инициализации векторной базы:', error);
    }
  }

  async generateText(userPrompt: string): Promise<{ intent: string; text: string }> {
    if (!this.vectorStore) {
      throw new Error('База знаний не инициализирована.');
    }

    try {
      console.log(`[AI Service] Поиск релевантных чанков для промпта: "${userPrompt}"`);
      const relevantDocs = await this.vectorStore.similaritySearch(userPrompt, 5);
      const context = relevantDocs
        .map((doc) => `Из документа ${doc.metadata.source}:\n${doc.pageContent}`)
        .join('\n\n---\n\n');
      console.log(`[AI Service] Найдено ${relevantDocs.length} релевантных чанков.`);

      const result = await this.model.generateContent([
        `Твоя первая и самая главная задача — определить намерение пользователя и ответить СТРОГО в формате JSON. Если пользователь просит сгенерировать, составить, оформить, создать документ, акт, заявление, отчет, договор или любой другой официальный файл, твой ответ ДОЛЖЕН быть в формате: {"intent": "generate_document", "response": "ЗДЕСЬ ПОЛНЫЙ ТЕКСТ ДОКУМЕНТА"}. Если же это просто вопрос, просьба о консультации или объяснении, твой ответ ДОЛЖЕН быть в формате: {"intent": "answer_question", "response": "ЗДЕСЬ ТЕКСТ ТВОЕГО ОТВЕТА"}. Это критически важно.

        Твоя вторая задача - быть 'Цифровым юристом-консультантом' для ОСИ в Казахстане и отвечать строго на основе предоставленного контекста. Категорически отказывайся отвечать на вопросы, не связанные с ОСИ.`,
        `Контекст из документов:\n\n${context}`,
        `Вопрос пользователя: "${userPrompt}"`,
      ]);

      const rawResponse = result.response.text();
      console.log('[AI Service] Получен сырой ответ от Gemini:', rawResponse);

      try {
        let cleanResponse = rawResponse.trim();

        // Удаление markdown-обертки, если есть
        if (cleanResponse.startsWith('```json')) {
          cleanResponse = cleanResponse.replace(/^```json/, '').replace(/```$/, '').trim();
        }

        const parsed = JSON.parse(cleanResponse);

        return {
          intent: parsed.intent || 'answer_question',
          text: parsed.response || 'Не удалось извлечь ответ из ответа модели.',
        };
      } catch (e) {
        console.warn('[AI Service] Gemini не вернул валидный JSON. Отдаю ответ как простой текст.');
        return { intent: 'answer_question', text: rawResponse };
      }
    } catch (error) {
      console.error('[AI Service] Ошибка при генерации текста:', error);
      throw new Error('Не удалось сгенерировать ответ от AI.');
    }
  }
}
