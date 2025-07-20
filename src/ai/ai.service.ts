// src/ai/ai.service.ts

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Content } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { TaskType } from '@google/generative-ai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ChatHistoryService } from '../chat/history/history.service';

@Injectable()
export class AiService implements OnModuleInit {
  private model: any;
  private vectorStore: MemoryVectorStore;

  constructor(
    private readonly configService: ConfigService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

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
        console.warn('[AI Service] Папка .pdf-cache не найдена. База знаний не будет загружена.');
        return;
      }
      const fileNames = fs.readdirSync(cacheDir);
      
      const documents = fileNames.map(fileName => ({
        pageContent: fs.readFileSync(path.join(cacheDir, fileName), 'utf-8'),
        metadata: { source: fileName.replace('.txt', '') },
      }));

      if (documents.length === 0) {
        console.warn('[AI Service] В кэше нет документов для индексации.');
        return;
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 200,
      });

      const docs = await splitter.splitDocuments(documents);
      console.log(`[AI Service] Документы разделены на ${docs.length} смысловых чанков.`);

      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: "embedding-001",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });

      this.vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      console.log(`[AI Service] Векторная база знаний успешно создана и готова к работе.`);

    } catch (error) {
      console.error('[AI Service] КРИТИЧЕСКАЯ ОШИБКА при инициализации векторной базы:', error);
    }
  }

  async getAiResponse(userPrompt: string, userId: number): Promise<string> {
    if (!this.vectorStore) {
      return 'Извините, база знаний сейчас не инициализирована.';
    }

    try {
      const history = await this.chatHistoryService.getHistory(userId);
      const relevantDocs = await this.vectorStore.similaritySearch(userPrompt, 3);
      const context = relevantDocs
        .map(doc => `Из документа ${doc.metadata.source}:\n${doc.pageContent}`)
        .join('\n\n---\n\n');

      const chatSession = this.model.startChat({
        history: history as Content[],
      });

      const finalPrompt = `
        Твоя роль — 'Цифровой юрист-консультант' для ОСИ в Казахстане. Отвечай строго на основе предоставленного контекста. Категорически отказывайся отвечать на вопросы, не связанные с ОСИ.

        Контекст из документов для ответа:
        ---
        ${context}
        ---

        Мой вопрос: "${userPrompt}"
      `;

      const result = await chatSession.sendMessage(finalPrompt);
      const responseText = result.response.text();

      await this.chatHistoryService.addMessageToHistory(userId, userPrompt, responseText);

      return responseText;
    } catch (error) {
      console.error('[AI Service] Ошибка при генерации текста:', error);
      throw new Error('Не удалось сгенерировать ответ от AI.');
    }
  }
}
