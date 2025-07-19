import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { TaskType } from "@google/generative-ai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

@Injectable()
export class AiService implements OnModuleInit {
  private model: any;
  private vectorStore: MemoryVectorStore;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY не найден в .env файле!');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
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

  async generateText(userPrompt: string): Promise<string> {
    if (!this.vectorStore) {
      return "Извините, база знаний сейчас не инициализирована. Пожалуйста, проверьте логи сервера.";
    }

    try {
      console.log(`[AI Service] Поиск релевантных чанков для промпта: "${userPrompt}"`);

      const relevantDocs = await this.vectorStore.similaritySearch(userPrompt, 5);
      const context = relevantDocs.map(doc => `Из документа ${doc.metadata.source}:\n${doc.pageContent}`).join('\n\n---\n\n');

      console.log(`[AI Service] Найдено ${relevantDocs.length} релевантных чанков. Формирую промпт для Gemini...`);

      const result = await this.model.generateContent([
        `Твоя роль — 'Цифровой юрист-консультант' для Объединений Собственников Имущества (ОСИ) в Казахстане. Твоя единственная задача — отвечать на вопросы и генерировать документы, строго основываясь на предоставленном контексте из официальных стандартов (СТ РК) и законов. **Категорически отказывайся отвечать на любые вопросы, не связанные с деятельностью ОСИ, законодательством РК в сфере ЖКХ или управлением недвижимостью.** На вопросы типа 'кто ты?', 'какая погода?', 'напиши стих' отвечай вежливо, но твердо, что ты специализированный помощник и можешь помочь только с вопросами по ОСИ.`,
        `Контекст из документов:\n\n${context}`,
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
