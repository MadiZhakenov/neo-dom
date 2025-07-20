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

@Injectable()
export class AiService implements OnModuleInit {
  private model: any;
  private vectorStore: MemoryVectorStore;
  private templateNames: string[];

  constructor(
    private readonly configService: ConfigService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  async onModuleInit() {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY не найден в .env файле!');
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    this.loadTemplateNames();
    await this.initializeVectorStore(apiKey);
  }

  private loadTemplateNames() {
    try {
      const templatesDir = path.join(process.cwd(), 'knowledge_base', 'templates', 'docx');
      this.templateNames = fs.readdirSync(templatesDir)
        .filter(f => f.endsWith('.docx'))
        .map(name => name.toLowerCase());
    } catch (error) {
      this.templateNames = [];
    }
  }

  private async initializeVectorStore(apiKey: string) {
    try {
      const cacheDir = path.join(process.cwd(), '.pdf-cache');
      if (!fs.existsSync(cacheDir)) {
        return;
      }
      const fileNames = fs.readdirSync(cacheDir);
      const documents = fileNames.map(fileName => ({
        pageContent: fs.readFileSync(path.join(cacheDir, fileName), 'utf-8'),
        metadata: { source: fileName.replace('.txt', '') },
      }));

      if (documents.length === 0) {
        return;
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 2000,
        chunkOverlap: 200,
      });

      const docs = await splitter.splitDocuments(documents);
      const embeddings = new GoogleGenerativeAIEmbeddings({
        apiKey,
        model: "embedding-001",
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });

      this.vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
    } catch (error) {}
  }

  async getChatResponse(prompt: string, userId: number): Promise<{ type: 'chat' | 'start_generation'; content: any }> {
    const history = await this.chatHistoryService.getHistory(userId);
    const chatSession = this.model.startChat({ history: history as Content[] });

    const finalPrompt = `
      Твоя задача — вести диалог и определить, когда пользователь хочет сгенерировать документ.
      Если он просит сгенерировать какой-либо документ, найди в его запросе наиболее подходящее название из списка ниже и ответь ТОЛЬКО в формате JSON: {"intent": "start_generation", "templateName": "имя_файла.docx"}.
      Имя файла шаблона должно быть в нижнем регистре.
      Если запрос не похож на просьбу о генерации документа, просто веди диалог как юрист-консультант по ОСИ.

      Список доступных для генерации документов:
      ${this.templateNames.map(name => `- ${name}`).join('\n')}
      
      Запрос пользователя: "${prompt}"
    `;

    try {
      const result = await chatSession.sendMessage(finalPrompt);
      const rawResponse = result.response.text();

      let parsed: any;
      try {
        const cleanResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleanResponse);
      } catch (e) {
        await this.chatHistoryService.addMessageToHistory(userId, prompt, rawResponse);
        return { type: 'chat', content: rawResponse };
      }

      if (parsed.intent === 'start_generation' && parsed.templateName) {
        await this.chatHistoryService.addMessageToHistory(userId, prompt, `Хорошо, давайте подготовим документ: ${parsed.templateName}. Сейчас я задам несколько уточняющих вопросов.`);
        return { type: 'start_generation', content: parsed.templateName };
      }

      await this.chatHistoryService.addMessageToHistory(userId, prompt, rawResponse);
      return { type: 'chat', content: rawResponse };
    } catch (error) {
      throw new Error('Не удалось получить ответ от AI для определения намерения.');
    }
  }

  async getFieldsForTemplate(templateName: string): Promise<any> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];

    if (!templateInfo || !templateInfo.tags_in_template) {
      throw new Error(`Шаблон "${normalizedTemplateName}" не найден в реестре или у него нет списка тегов.`);
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
        Я предоставлю тебе список всех полей (тегов), которые существуют в DOCX-версии этого шаблона. Твоя задача - для каждого тега из этого списка сгенерировать понятный вопрос для пользователя. Вопросы должны быть на языке документа (русский или казахский, который ты определишь по тексту PDF).
        
        Верни ответ СТРОГО в виде JSON-массива объектов, где каждый объект имеет два поля: "tag" (имя тега, которое ты определишь из контекста, на английском, например "address" или "sender_fio") и "question" (понятный вопрос для пользователя).
        Если какой-то тег из списка не очевиден из PDF, придумай стандартный вопрос.
        
        Список тегов для заполнения:
        ${templateInfo.tags_in_template.map(tag => `- ${tag}`).join('\n')}
      `;

      const result = await this.model.generateContent([
        prompt,
        { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }
      ]);

      const rawResponse = result.response.text();
      const cleanResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      throw new Error('Не удалось проанализировать шаблон документа.');
    }
  }

  async extractDataForDocx(userAnswersPrompt: string, templateName: string): Promise<any> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];

    if (!templateInfo || !templateInfo.tags_in_template) {
      throw new Error(`Шаблон ${normalizedTemplateName} не найден в реестре или у него нет списка тегов.`);
    }

    const expectedTags = templateInfo.tags_in_template.map(tag => `- ${tag}`).join('\n');

    const prompt = `
      Твоя задача — извлечь конкретные данные из моего запроса.
      Запрос пользователя будет содержать ответы на вопросы для заполнения документа "${templateInfo.name}".
      Ты должен извлечь эти ответы и вернуть их СТРОГО в формате JSON.
      Ключи JSON-объекта ДОЛЖНЫ ТОЧНО соответствовать предоставленным тегам.
      Если тег представляет собой массив данных (например, для таблицы), он должен быть JSON-массивом объектов. Для таблиц, пожалуйста, убедитесь, что каждый объект в массиве содержит все ожидаемые теги (например, "index", "name", "sheet_count", "notes").
      Не придумывай данные, если их нет в запросе. Если данные для тега отсутствуют, оставь поле пустым или null.

      Список тегов, которые ты должен извлечь (ключи JSON):
      ${expectedTags}

      Пример ожидаемого JSON (для таблицы "documents", если применимо):
      "documents": [
        {"doc_index": 1, "doc_name": "Имя документа 1", "doc_sheet_count": "10", "doc_notes": "Примечания 1"},
        {"doc_index": 2, "doc_name": "Имя документа 2", "doc_sheet_count": "5", "doc_notes": "Примечания 2"}
      ]

      Запрос пользователя с данными: "${userAnswersPrompt}"
      Верни ТОЛЬКО валидный JSON и ничего больше.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const rawResponse = result.response.text();
      const cleanResponse = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanResponse);
    } catch (error) {
      throw new Error('Не удалось извлечь данные для заполнения документа.');
    }
  }
}
