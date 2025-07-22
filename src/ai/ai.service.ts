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
  private _templateNames: { fileName: string, humanName: string }[];
  private currentLanguage: 'ru'|'kz' = 'ru';

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
    this.primaryModel = genAI.getGenerativeModel({ model: 'gemini-1.5-pro-latest' });
    this.fallbackModel = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
    console.log('[AI Service] Основная и резервная модели Gemini успешно инициализированы.');
    
    this.loadAndValidateTemplates();
    await this.initializeVectorStore(apiKey); 
  }

  private loadAndValidateTemplates() {
    console.log('[AI Service] Загрузка и валидация шаблонов...');
    this._templateNames = [];
    
    for (const [fileName, details] of Object.entries(TEMPLATES_REGISTRY)) {
        if (!details.name || !details.tags_in_template || !Array.isArray(details.tags_in_template)) {
            console.error(`[AI Service] ОШИБКА КОНФИГУРАЦИИ: Шаблон ${fileName} в templates.registry.ts не имеет поля 'name' или 'tags_in_template'!`);
            continue;
        }
        this._templateNames.push({
            fileName: fileName.toLowerCase(),
            humanName: details.name
        });
    }
    console.log(`[AI Service] Загружено и провалидировано ${this._templateNames.length} шаблонов.`);
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

  private detectLanguage(text: string): 'ru'|'kz' {
    const kzSpecificChars = /[әғқңөұүіһӘҒҚҢӨҰҮІҺ]/;
    const kzCommonWords = /(және|немесе|үшін|сондай|сол|бірақ|екен|деп|осылайша|алайда)/i;
    if (kzSpecificChars.test(text) || kzCommonWords.test(text)) {
        return 'kz';
    }
    return 'ru';
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
          console.warn('[AI Service] Все попытки для основной модели провалились. Переключаюсь на резервную модель...');
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
  
  private async getFactualAnswer(prompt: string, history: Content[]): Promise<string> {
    if (!this.vectorStore) {
        throw new Error('База знаний не инициализирована.');
    }
    const relevantDocs = await this.vectorStore.similaritySearch(prompt, 3);
    const context = relevantDocs.map(doc => `Из документа ${doc.metadata.source}:\n${doc.pageContent}`).join('\n\n---\n\n');
    
    const finalPrompt = `
      Твоя роль — 'Цифровой юрист-консультант' для ОСИ в Казахстане. Отвечай строго на основе предоставленного ниже контекста из документов.
      ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Отвечай на том же языке (русский или казахский), на котором задан "Мой вопрос".
      Если в контексте нет ответа, вежливо сообщи об этом. Не отвечай на вопросы не по теме.

      Контекст из документов для ответа:
      ---
      ${context}
      ---

      Мой вопрос: "${prompt}"
    `;
    return this.generateWithRetry(finalPrompt, history);
  }

  async getAiResponse(prompt: string, userId: number): Promise<{ type: 'chat' | 'start_generation'; content: any }> {
    try {
      this.currentLanguage = this.detectLanguage(prompt);
      const history = await this.chatHistoryService.getHistory(userId);

      console.log('[AI Service] Все шаблоны:', this._templateNames);
        
      const intentDetectionPrompt = `
        Определи намерение пользователя. 
        Если он просит сгенерировать документ, найди наиболее подходящее название из списка и ответь ТОЛЬКО JSON: {"intent": "start_generation", "templateName": "точное_имя_файла.docx"}.
        Если это просто вопрос, ответь ТОЛЬКО JSON: {"intent": "chat_response"}.

        Список доступных шаблонов (и их имена файлов для ответа):
        ${this._templateNames.map(t => `- "${t.humanName}" (файл: ${t.fileName})`).join('\n')}
            
        Запрос пользователя: "${prompt}"
      `;

      const rawResponse = await this.generateWithRetry(intentDetectionPrompt);
      console.log('[AI Service] Сырой ответ на определение намерения:', rawResponse);

      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
          console.warn('[AI Service] Не удалось распознать намерение, перехожу к RAG-ответу.');
          const answer = await this.getFactualAnswer(prompt, history as Content[]);
          await this.chatHistoryService.addMessageToHistory(userId, prompt, answer);
          return { type: 'chat', content: answer };
      }

      const parsed = JSON.parse(jsonMatch[0]);
      console.log('[AI Service] Распарсенное намерение:', parsed);

      if (parsed.intent === 'start_generation' && parsed.templateName) {
        const foundTemplate = this._templateNames.find(t => t.fileName === parsed.templateName.toLowerCase());
            
        if (foundTemplate) {
          const confirmationMessage = this.currentLanguage === 'kz' ?
            `Әрине, "${foundTemplate.humanName}" құжатын дайындауға көмектесемін.` :
            `Конечно, я помогу вам подготовить документ: "${foundTemplate.humanName}".`;

          await this.chatHistoryService.addMessageToHistory(userId, prompt, confirmationMessage);
          return { type: 'start_generation', content: foundTemplate.fileName };
        }
      }
      
      const answer = await this.getFactualAnswer(prompt, history as Content[]);
      await this.chatHistoryService.addMessageToHistory(userId, prompt, answer);
      return { type: 'chat', content: answer };

    } catch (error) {
      console.error('[AI Service] Ошибка в getAiResponse:', error);
      const errorMessage = this.currentLanguage === 'kz' ?
        'Кешіріңіз, сұранысыңызды өңдеу кезінде ішкі қате пайда болды.' :
        'Извините, произошла внутренняя ошибка при обработке вашего запроса.';
      
      await this.chatHistoryService.addMessageToHistory(userId, prompt, errorMessage);
      return { type: 'chat', content: errorMessage };
    }
  }

  async getFieldsForTemplate(templateName: string): Promise<any> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];

    if (!templateInfo || !templateInfo.tags_in_template) {
      throw new Error(`Ошибка конфигурации: Шаблон "${templateName}" не настроен.`);
    }
    
    try {
      const pdfPreviewPath = path.join(process.cwd(), 'knowledge_base', 'templates', 'pdf_previews', normalizedTemplateName.replace('.docx', '.pdf'));
      if (!fs.existsSync(pdfPreviewPath)) {
        throw new Error(`PDF-превью для шаблона "${normalizedTemplateName}" не найдено.`);
      }

      const pdfBuffer = fs.readFileSync(pdfPreviewPath);
      const base64Pdf = pdfBuffer.toString('base64');
      
      const prompt = `
        Проанализируй этот PDF-документ. Он является шаблоном.
        Твоя задача - составить список вопросов для пользователя, чтобы собрать все необходимые данные для заполнения этого документа.
        Верни ответ СТРОГО в виде JSON-массива объектов, где каждый объект имеет два поля: "tag" и "question".
        
        ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Вопросы должны быть на том же языке, на котором написан текст в PDF-шаблоне (русский или казахский).
        
        Особое правило для тегов-массивов: Если в списке тегов есть тег, обозначающий массив (например, "documents"), ты ДОЛЖЕН задать ОДИН, ПОДРОБНЫЙ вопрос для этого родительского тега.
        НЕ ЗАДАВАЙ ОТДЕЛЬНЫЕ ВОПРОСЫ для под-полей (например, "doc_index", "doc_name").
        
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

  async formatQuestionsForUser(fields: any[], templateName: string): Promise<string> {
    const templateHumanName = TEMPLATES_REGISTRY[templateName.toLowerCase()]?.name || templateName;
    
    const prompt = `
      Ты - чат-бот-помощник. Из следующего JSON-массива вопросов сформируй красивый, форматированный текст, который можно показать пользователю для сбора данных.
      Текст должен быть вежливым, понятным и содержать примеры для сложных полей.

      ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь текст ответа (заголовки, вопросы, примеры) должен быть на том же языке (русский или казахский), на котором сформулированы "question" в предоставленном JSON-массиве. Не переводи их.

      Не используй Markdown для форматирования (жирный текст для заголовков, списки для перечислений).
      Не включай никаких вводных слов вроде "Конечно, вот...", просто сам опросник.

      Начни с заголовка, например: **Для заполнения документа "${templateHumanName}" потребуется следующая информация:**

      Пример желаемого формата для полей:
      1. Адрес объекта: Укажите полный адрес. (Пример: г. Астана, ул. Достык, 5)
      2. Документы: Введите информацию о каждом документе с новой строки. (Пример: 1. Паспорт лифта (5 листов))

      JSON-массив с вопросами, который нужно отформатировать:
      ${JSON.stringify(fields, null, 2)}
    `;

    return this.generateWithRetry(prompt);
  }

  async extractDataForDocx(userAnswersPrompt: string, templateName: string): Promise<any> {
    console.log(`[AI Service] Начинаю извлечение данных для шаблона: ${templateName}`);
    
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];

    if (!templateInfo || !templateInfo.tags_in_template) {
        throw new Error(`Шаблон "${templateName}" не найден или не настроен в templates.registry.ts.`);
    }

    console.log(`[AI Service] Ожидаемые теги: ${templateInfo.tags_in_template.join(', ')}`);

    const prompt = `
        Твоя задача — извлечь данные из следующего текста и структурировать их в JSON.
        Требования:
        1. Используй предоставленные теги.
        2. Для массивов (например, 'documents') создавай массив объектов.
        3. Если данных для какого-то тега нет в тексте — оставляй поле пустым или null.
        
        ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Данные для заполнения (значения в JSON) должны быть на том же языке, на котором они предоставлены в "Тексте для анализа". Не переводи имена собственные, адреса и другие данные.
        
        Теги для извлечения: ${templateInfo.tags_in_template.join(', ')}
        
        Пример правильного формата для массива "documents":
        "documents": [
            { "doc_index": "1", "doc_name": "Проектная документация", "doc_sheet_count": "45", "doc_notes": "Раздел АР" }
        ]
        
        Текст для анализа:
        "${userAnswersPrompt}"
        
        Верни JSON без дополнительных комментариев или оберток.
    `;

    try {
        console.log('[AI Service] Отправка промпта на извлечение данных в ИИ...');
        const rawResponse = await this.generateWithRetry(prompt);
        console.log('[AI Service] Сырой ответ с извлеченными данными:', rawResponse);

        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Не удалось извлечь JSON из ответа AI');
        }
        
        const extractedData = JSON.parse(jsonMatch[0]);
        console.log('[AI Service] Успешно извлеченные данные:', extractedData);
        return extractedData;
        
    } catch (error) {
        console.error('[AI Service] Ошибка при извлечении данных:', error);
        throw new Error(`Не удалось извлечь данные для шаблона ${templateName}. Пожалуйста, проверьте формат вводимых данных.`);
    }
  }
}