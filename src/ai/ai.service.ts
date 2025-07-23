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

        // Улучшенный промпт для определения намерения
        const intentDetectionPrompt = `
Твоя задача - определить намерение пользователя. Варианты намерений:
1.  "start_generation": Пользователь явно хочет создать, сгенерировать, оформить или заполнить какой-то документ. Ключевые слова: "создай", "сделай", "оформи", "заполни", "сгенерируй", "акт", "форма", "отчет" и т.д.
2.  "chat_response": Пользователь задает вопрос, просит консультацию, или его запрос не связан с генерацией документа.

Проанализируй запрос пользователя и список доступных шаблонов.
- Если намерение "start_generation", найди самый подходящий шаблон из списка и верни ТОЛЬКО JSON:
  {"intent": "start_generation", "templateName": "точное_имя_файла.docx"}
- Если намерение "chat_response", верни ТОЛЬКО JSON:
  {"intent": "chat_response"}

Список доступных шаблонов (и их имена файлов для ответа):
${this._templateNames.map(t => `- "${t.humanName}" (файл: ${t.fileName})`).join('\n')}

Запрос пользователя: "${prompt}"
`;

        const rawResponse = await this.generateWithRetry(intentDetectionPrompt);
        // Улучшенная, более надежная очистка ответа от мусора
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            console.warn('[AI Service] Не удалось распознать намерение в формате JSON, перехожу к RAG-ответу как к запасному варианту.');
            const answer = await this.getFactualAnswer(prompt, history as Content[]);
            await this.chatHistoryService.addMessageToHistory(userId, prompt, answer);
            return { type: 'chat', content: answer };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        console.log('[AI Service] Распарсенное намерение:', parsed);

        if (parsed.intent === 'start_generation' && parsed.templateName) {
            const foundTemplate = this._templateNames.find(t => t.fileName === parsed.templateName.toLowerCase());

            if (foundTemplate) {
                const confirmationMessage = this.currentLanguage === 'kz'
                    ? `Әрине, "${foundTemplate.humanName}" құжатын дайындауға көмектесемін.`
                    : `Конечно, я помогу вам подготовить документ: "${foundTemplate.humanName}".`;

                await this.chatHistoryService.addMessageToHistory(userId, prompt, confirmationMessage);
                return { type: 'start_generation', content: foundTemplate.fileName };
            }
        }

        // Если намерение 'chat_response' или шаблон не найден, то отвечаем как консультант
        const answer = await this.getFactualAnswer(prompt, history as Content[]);
        await this.chatHistoryService.addMessageToHistory(userId, prompt, answer);
        return { type: 'chat', content: answer };

    } catch (error) {
        console.error('[AI Service] Ошибка в getAiResponse:', error);
        const errorMessage = this.currentLanguage === 'kz'
            ? 'Кешіріңіз, сұранысыңызды өңдеу кезінде ішкі қате пайда болды.'
            : 'Извините, произошла внутренняя ошибка при обработке вашего запроса.';
        await this.chatHistoryService.addMessageToHistory(userId, prompt, errorMessage); // Логируем ошибку в историю
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

  async extractDataForDocx(
    userAnswersPrompt: string,
    templateName: string
  ): Promise<{
    data: any;
    isComplete: boolean;
    missingFields?: { tag: string, question: string }[];
  }> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];
    if (!templateInfo || !templateInfo.tags_in_template) {
        throw new Error(`Шаблон "${templateName}" не найден или не настроен.`);
    }

    const fields = await this.getFieldsForTemplate(templateName);
    const fieldMap = new Map(fields.map(f => [f.tag, f.question]));
    const requiredFields = templateInfo.tags_in_template.map(tag => ({
        tag,
        question: fieldMap.get(tag) || `Укажите значение для ${tag}`
    }));

    // ИСПРАВЛЕННАЯ ВЕРСИЯ ПРОМПТА
    const prompt = `
Твоя задача - проанализировать текст пользователя и извлечь из него данные для заполнения шаблона документа.

ВАЖНОЕ ПРАВИЛО ДЛЯ СПИСКОВ И ТАБЛИЦ:
Некоторые поля представляют собой списки (массивы), например, список документов или членов комиссии. Для таких полей ты ДОЛЖЕН создать массив JSON-объектов.
Например, если в шаблоне есть цикл для поля "documents" с тегами "doc_name" и "doc_quantity", и пользователь пишет:
"Нужны такие документы: 1. Паспорт на 5 листах, 2. Акт осмотра на 2 листах",
то в поле "data" для ключа "documents" должен быть массив:
"documents": [
  { "doc_name": "Паспорт", "doc_quantity": "5 листах" },
  { "doc_name": "Акт осмотра", "doc_quantity": "2 листах" }
]

Проанализируй следующий текст и извлеки данные.
Требуемые поля и их теги: ${JSON.stringify(requiredFields, null, 2)}

Текст для анализа от пользователя:
"${userAnswersPrompt}"

Верни ответ СТРОГО в формате JSON. Не добавляй никаких пояснений или \`\`\`json.

Формат ответа:
{
  "isComplete": /* boolean: true если все данные найдены, иначе false */,
  "missingFields": /* массив объектов [{tag: string, question: string}] или null. Заполняется ТОЛЬКО если isComplete=false */,
  "data": /* объект с извлеченными данными. Ключи объекта - это теги полей. Этот объект должен быть здесь ВСЕГДА, даже если он неполный. */
}
`;

    try {
        const rawResponse = await this.generateWithRetry(prompt);
        // Убираем возможные "обертки" ответа модели
        const cleanResponse = rawResponse.replace(/^```json/g, '').replace(/```$/g, '').trim();
        return JSON.parse(cleanResponse);
    } catch (error) {
        console.error('Ошибка извлечения данных:', error);
        // Возвращаем корректную структуру в случае ошибки
        return {
            isComplete: false,
            missingFields: requiredFields,
            data: {} // Возвращаем пустой объект, а не null
        };
    }
  }
  async analyzeInputDuringDataCollection(prompt: string, currentTemplateName: string): Promise<{ intent: 'provide_data' | 'switch_document' | 'general_query'; templateName?: string }> {
    const intentAnalysisPrompt = `
      Твоя задача - проанализировать сообщение пользователя, который сейчас находится в процессе заполнения документа "${currentTemplateName}". Определи его истинное намерение.

      Возможные намерения:
      1. "provide_data": Пользователь предоставляет запрошенные данные. Это наиболее вероятный сценарий. Сообщение содержит адреса, ФИО, даты, списки и т.д.
      2. "switch_document": Пользователь явно выражает желание отменить текущий процесс и начать заполнять ДРУГОЙ документ. Он может написать "сделай другой акт" или "хочу оформить [название другого документа]".
      3. "general_query": Сообщение пользователя не является ни данными, ни запросом на смену документа. Это может быть вопрос ("какой сегодня день?"), отмена ("отмена", "cancel") или просто приветствие.

      Список ВСЕХ доступных документов:
      ${this._templateNames.map(t => `- "${t.humanName}" (файл: ${t.fileName})`).join('\n')}

      Проанализируй запрос и верни ТОЛЬКО JSON:
      - Если это данные, верни: {"intent": "provide_data"}
      - Если это запрос на смену документа, найди самый подходящий и верни: {"intent": "switch_document", "templateName": "точное_имя_файла.docx"}
      - Если это отмена или общий вопрос, верни: {"intent": "general_query"}

      Запрос пользователя: "${prompt}"
    `;

    const rawResponse = await this.generateWithRetry(intentAnalysisPrompt);
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Если модель не смогла определить, по умолчанию считаем, что это данные
    console.warn('[AI Service] Не удалось определить вложенное намерение, по умолчанию считаем, что это данные.');
    return { intent: 'provide_data' };
  }
}