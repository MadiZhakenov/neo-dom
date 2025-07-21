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
import { TEMPLATES_REGISTRY } from './templates.registry';

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

@Injectable()
export class AiService implements OnModuleInit {
  private primaryModel: any;
  private fallbackModel: any;
  private vectorStore: MemoryVectorStore;
  private _templateNames: string[];

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
    this.primaryModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    this.fallbackModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    console.log('[AI Service] Основная и резервная модели Gemini успешно инициализированы.');
    
    this.loadTemplateNames();
    await this.initializeVectorStore(apiKey); 
  }

  private loadTemplateNames() {
    console.log('[AI Service] Загрузка имен шаблонов...');
    try {
      const templatesDir = path.join(process.cwd(), 'knowledge_base', 'templates', 'docx');
      this._templateNames = fs.readdirSync(templatesDir)
        .filter(f => f.endsWith('.docx'))
        .map(name => name.toLowerCase());
      console.log(`[AI Service] Загружено ${this._templateNames.length} имен шаблонов.`);
    } catch (error) {
      console.error('[AI Service] Ошибка при загрузке имен шаблонов:', error);
      this._templateNames = [];
    }
  }

  private async initializeVectorStore(apiKey: string) {
    console.log('[AI Service] Инициализация векторной базы знаний...');
    try {
      const cacheDir = path.join(process.cwd(), '.pdf-cache');
      if (!fs.existsSync(cacheDir)) {
        console.warn('[AI Service] Папка .pdf-cache не найдена.');
        return;
      }
      const fileNames = fs.readdirSync(cacheDir);
      
      const documents = fileNames.map(fileName => ({
        pageContent: fs.readFileSync(path.join(cacheDir, fileName), 'utf-8'),
        metadata: { source: fileName.replace('.txt', '') },
      }));

      if (documents.length === 0) { return; }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 200,
      });

      const docs = await splitter.splitDocuments(documents);
      console.log(`[AI Service] Документы разделены на ${docs.length} чанков.`);

      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: "embedding-001",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });

      this.vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      console.log(`[AI Service] Векторная база знаний создана.`);

    } catch (error) {
      console.error('[AI Service] Ошибка при инициализации векторной базы:', error);
    }
  }

  private async generateWithRetry(prompt: any, history: Content[] = [], retries = 3): Promise<string> {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`[AI Service] Попытка #${i + 1} отправки запроса...`);
        const chatSession = this.primaryModel.startChat({ history });
        const result = await chatSession.sendMessage(prompt);
        return result.response.text();
      } catch (error) {
        if (error.status === 503 && i < retries - 1) {
          const waitTime = Math.pow(2, i) * 1000;
          console.warn(`[AI Service] Модель перегружена (503). Повторная попытка через ${waitTime / 1000} сек...`);
          await delay(waitTime);
        } else if (i === retries - 1) {
          console.warn('[AI Service] Все попытки для основной модели провалились. Переключаюсь на резервную модель (gemini-1.5-pro-latest)...');
          try {
            const fallbackChatSession = this.fallbackModel.startChat({ history });
            const fallbackResult = await fallbackChatSession.sendMessage(prompt);
            return fallbackResult.response.text();
          } catch (fallbackError) {
            console.error('[AI Service] Резервная модель также не ответила.', fallbackError);
            throw fallbackError;
          }
        } else {
          throw error;
        }
      }
    }
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }

  async getAiResponse(prompt: string, userId: number): Promise<{ type: 'chat' | 'start_generation'; content: any }> {
    if (!this.vectorStore) {
      throw new Error('База знаний не инициализирована.');
    }

    try {
      const history = await this.chatHistoryService.getHistory(userId);
      const relevantDocs = await this.vectorStore.similaritySearch(prompt, 3);
      const context = relevantDocs.map(doc => `Из документа ${doc.metadata.source}:\n${doc.pageContent}`).join('\n\n---\n\n');

      const finalPrompt = `
        Твоя первая задача — определить намерение пользователя и ответить СТРОГО в формате JSON.
        Если пользователь просит сгенерировать документ, найди наиболее подходящее название из списка и ответь: {"intent": "start_generation", "templateName": "имя_файла.docx"}.
        Если это просто вопрос, ответь: {"intent": "chat_response", "response": "Твой ответ здесь."}.
        НЕ ВКЛЮЧАЙ НИКАКОГО РАЗГОВОРНОГО ТЕКСТА ПЕРЕД JSON.

        Твоя вторая задача - быть 'Цифровым юристом-консультантом' по ОСИ и отвечать, основываясь на контексте.

        Список доступных документов:
        ${this._templateNames.map(name => `- ${name}`).join('\n')}
        
        Контекст из документов:
        ---
        ${context}
        ---

        История диалога:
        ${history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n')}

        Запрос пользователя: "${prompt}"
      `;

      const rawResponse = await this.generateWithRetry(finalPrompt);
      console.log('[AI Service] Ответ от ИИ (RAW):', rawResponse);

      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch || !jsonMatch[0]) {
        throw new Error('No JSON in response');
      }
      const parsed = JSON.parse(jsonMatch[0]);

      if (parsed.intent === 'start_generation' && parsed.templateName) {
        const foundTemplate = this._templateNames.includes(parsed.templateName);
        if (!foundTemplate) {
            const errorMessage = `Извините, я не могу найти шаблон с названием "${parsed.templateName}".`;
            await this.chatHistoryService.addMessageToHistory(userId, prompt, errorMessage);
            return { type: 'chat', content: errorMessage };
        }
        await this.chatHistoryService.addMessageToHistory(userId, prompt, `Хорошо, давайте подготовим документ: ${parsed.templateName}.`);
        return { type: 'start_generation', content: parsed.templateName };
      }
      
      const answer = parsed.response || rawResponse; // Fallback
      await this.chatHistoryService.addMessageToHistory(userId, prompt, answer);
      return { type: 'chat', content: answer };

    } catch (error) {
      console.error('[AI Service] Ошибка в getAiResponse:', error);
      throw new Error('Не удалось получить ответ от AI.');
    }
  }

  async getFieldsForTemplate(templateName: string): Promise<any> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];

    if (!templateInfo || !templateInfo.tags_in_template) {
      throw new Error(`Ошибка конфигурации: Шаблон "${normalizedTemplateName}" не настроен.`);
    }
    
    try {
      const pdfPreviewPath = path.join(
        process.cwd(), 
        'knowledge_base', 
        'templates', 
        'pdf_previews', 
        normalizedTemplateName.replace('.docx', '.pdf')
      );
      
      if (!fs.existsSync(pdfPreviewPath)) {
        throw new Error(`PDF-превью для шаблона "${normalizedTemplateName}" не найдено.`);
      }

      const pdfBuffer = fs.readFileSync(pdfPreviewPath);
      const base64Pdf = pdfBuffer.toString('base64');
      
      const prompt = `
        Проанализируй этот PDF-документ. Он является шаблоном.
        Твоя задача - составить список вопросов для пользователя, чтобы собрать все необходимые данные для заполнения этого документа.
        Верни ответ СТРОГО в виде JSON-массива объектов, где каждый объект имеет два поля: "tag" и "question".
        Особое правило для тегов-массивов: Если в списке тегов есть тег, обозначающий массив (например, "documents"), ты ДОЛЖЕН задать ОДИН, ПОДРОБНЫЙ вопрос для этого родительского тега. Этот вопрос должен объяснить пользователю, как ввести информацию для КАЖДОГО элемента списка. НЕ ЗАДАВАЙ ОТДЕЛЬНЫЕ ВОПРОСЫ для под-полей (например, "doc_index", "doc_name").
        Список всех тегов, которые ты должен учесть:
        ${templateInfo.tags_in_template.map(tag => `- ${tag}`).join('\n')}
      `;
      
      const result = await this.generateWithRetry([
        prompt,
        { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
      ]);
      
      const cleanResponse = result.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanResponse);
      
    } catch (error) {
      console.error(`[AI Service] Ошибка при анализе шаблона ${normalizedTemplateName}:`, error);
      throw new Error('Не удалось проанализировать шаблон документа.');
    }
  }

  async extractDataForDocx(userAnswersPrompt: string, templateName: string): Promise<any> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];

    if (!templateInfo || !templateInfo.tags_in_template) {
      throw new Error(`Ошибка конфигурации: Шаблон "${normalizedTemplateName}" не настроен.`);
    }

    const expectedTags = templateInfo.tags_in_template.map(tag => `- ${tag}`).join('\n');

    const prompt = `
      Твоя задача — извлечь конкретные данные из моего запроса и вернуть их СТРОГО в формате JSON.
      Ключи JSON-объекта ДОЛЖНЫ ТОЧНО соответствовать предоставленным тегам.
      Если тег представляет собой массив данных, он должен быть JSON-массивом объектов.
      Не придумывай данные, если их нет в запросе.
      Список тегов, которые ты должен извлечь:
      ${expectedTags}
      Запрос пользователя с данными: "${userAnswersPrompt}"
      Верни ТОЛЬКО валидный JSON и ничего больше.
    `;

    try {
      const rawResponse = await this.generateWithRetry(prompt);
      const cleanResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      console.error('[AI Service] Ошибка при извлечении данных для DOCX:', error);
      throw new Error('Не удалось извлечь данные для заполнения документа.');
    }
  }
}