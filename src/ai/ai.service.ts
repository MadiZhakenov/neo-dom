import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";

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
      if (!fs.existsSync(cacheDir)) {
        console.warn('[AI Service] Папка .pdf-cache не найдена. База знаний пуста.');
        return;
      }
      const fileNames = fs.readdirSync(cacheDir);
      const documents = fileNames.map(fileName => {
        const filePath = path.join(cacheDir, fileName);
        return {
          pageContent: fs.readFileSync(filePath, 'utf-8'),
          metadata: { source: fileName },
        };
      });

      if (documents.length === 0) {
        console.warn('[AI Service] В кэше нет документов для индексации.');
        return;
      }

      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: "embedding-001",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });

      this.vectorStore = await MemoryVectorStore.fromDocuments(documents, embeddings);
      console.log(`[AI Service] Векторная база знаний создана. Проиндексировано ${documents.length} документов.`);

    } catch (error) {
      console.error('[AI Service] Ошибка при инициализации векторной базы:', error);
    }
  }

  async generateText(userPrompt: string): Promise<string> {
    if (!this.vectorStore) {
        return "Извините, база знаний сейчас недоступна. Попробуйте позже.";
    }

    try {
      console.log(`[AI Service] Поиск релевантных документов для промпта: "${userPrompt}"`);

      const relevantDocs = await this.vectorStore.similaritySearch(userPrompt, 3);
      const context = relevantDocs.map(doc => `Документ: ${doc.metadata.source}\n\n${doc.pageContent}`).join('\n\n---\n\n');

      console.log(`[AI Service] Найдено ${relevantDocs.length} релевантных документов. Отправка в Gemini...`);

      const result = await this.model.generateContent([
        `Ты — помощник по вопросам управления ОСИ в Казахстане. Отвечай строго на основе предоставленного ниже контекста из документов. Если в контексте нет ответа, вежливо сообщи об этом. Контекст:\n\n${context}`,
        `Вопрос пользователя: "${userPrompt}"`,
      ]);
      
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
