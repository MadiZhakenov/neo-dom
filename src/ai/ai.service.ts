/**
 * @file src/ai/ai.service.ts
 * @description Сервис, инкапсулирующий всю логику взаимодействия с AI-моделями Google Gemini.
 * Отвечает за определение намерений, генерацию ответов, вопросов к документам и извлечение данных.
 */

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI, Content, TaskType } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { ChatHistoryService } from '../chat/history/history.service';
import { TEMPLATES_REGISTRY } from './templates.registry';
import { User } from '../users/entities/user.entity';

// Вспомогательная функция для создания задержки (используется в механизме retry).
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

@Injectable()
export class AiService implements OnModuleInit {
  /** Основная, более мощная модель (gemini-1.5-pro) */
  private primaryModel: any;
  /** Резервная, более быстрая модель на случай сбоя основной (gemini-1.5-flash) */
  private fallbackModel: any;
  /** In-memory база данных для векторного поиска по документам (RAG) */
  private vectorStore: MemoryVectorStore;
  /** Кэшированный и нормализованный список имен шаблонов для внутреннего использования */
  private _templateNames: { fileName: string; humanName: string }[];
  /** Язык, определенный для текущего запроса ('ru' или 'kz') */
  private currentLanguage: 'ru' | 'kz' = 'ru';

  constructor(
    private readonly configService: ConfigService,
    private readonly chatHistoryService: ChatHistoryService,
  ) {}

  /**
   * Метод жизненного цикла NestJS. Выполняется один раз при старте приложения.
   * Инициализирует AI-модели, загружает и валидирует шаблоны, создает векторную базу знаний.
   */
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

  /**
   * Загружает информацию о шаблонах из реестра, проверяет их структуру и кэширует для использования.
   */
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
        humanName: details.name,
      });
    }
    console.log(`[AI Service] Загружено и провалидировано ${this._templateNames.length} шаблонов.`);
  }

  /**
   * Создает векторную базу знаний из текстовых файлов в папке .pdf-cache.
   * Эти векторы используются для поиска релевантной информации при ответах на вопросы (RAG).
   * @param apiKey - API ключ для сервиса эмбеддингов Google.
   */
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
      const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 2000, chunkOverlap: 200 });
      const docs = await splitter.splitDocuments(documents);
      console.log(`[AI Service] Документы разделены на ${docs.length} чанков.`);
      const embeddings = new GoogleGenerativeAIEmbeddings({ apiKey, model: "embedding-001", taskType: TaskType.RETRIEVAL_DOCUMENT });
      this.vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      console.log('[AI Service] Векторная база знаний создана.');
    } catch (error) {
      console.error('[AI Service] Ошибка при инициализации векторной базы:', error);
    }
  }

  /**
   * Определяет язык текста (русский или казахский) по наличию специфических символов или common-слов.
   * @param text - Входной текст пользователя.
   * @returns 'ru' или 'kz'.
   */
  public detectLanguage(text: string): 'ru' | 'kz' {
    const kzSpecificChars = /[әғқңөұүіһӘҒҚҢӨҰҮІҺ]/;
    if (kzSpecificChars.test(text)) { return 'kz'; }
    const kzCommonWords = /(және|немесе|туралы|бойынша|бастап|дейін|үшін|арқылы)/i;
    if (kzCommonWords.test(text)) { return 'kz'; }
    return 'ru';
  }

  /**
   * Отправляет промпт в AI модель с надежным механизмом повторных попыток и переключением на резервную модель в случае сбоя.
   * @param prompt - Промпт для AI (может быть строкой или сложным объектом с медиа).
   * @param history - История чата для сохранения контекста.
   * @param retries - Количество повторных попыток.
   * @returns Текстовый ответ от AI.
   */
  private async generateWithRetry(prompt: any, history: Content[] = [], retries = 3): Promise<string> {
    const model = history.length > 0 ? this.primaryModel : this.fallbackModel;
    for (let i = 0; i < retries; i++) {
      try {
         // 1. Начинаем сессию, передавая всю предыдущую историю
         const chatSession = model.startChat({
          history: history,
        });
        // 2. Отправляем ТОЛЬКО новый промпт, без истории
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
          console.error('[AI Service] Неперехватываемая ошибка от Gemini API:', error);
          throw error;
        }
      }
    }
    // Эта строка выполнится только если все попытки, включая резервную модель, провалились.
    throw new Error('Не удалось получить ответ от AI после всех попыток.');
  }

  /**
   * Генерирует ответ на вопрос пользователя, используя контекст из векторной базы (RAG - Retrieval-Augmented Generation).
   * @param prompt - Запрос пользователя.
   * @param history - История чата.
   * @param language - Язык, на котором должен быть сформулирован ответ.
   * @returns Фактический ответ от AI, основанный на документах.
   */
  private async getFactualAnswer(prompt: string, history: Content[], language: 'ru' | 'kz'): Promise<string> {
    const relevantDocs = this.vectorStore ? await this.vectorStore.similaritySearch(prompt, 4) : [];
    
    let finalPrompt: string;

    if (relevantDocs.length > 0) {
      // **ПОТОК А: РЕЖИМ "СТРОГОГО ЮРИСТА" (RAG)**
      // Этот промпт будет использоваться ТОЛЬКО тогда, когда найдены релевантные документы.
      // Он простой, строгий и не пытается вести сложный диалог.
      console.log(`[AI Service] Найдены ${relevantDocs.length} релевантных документа. Включаю режим RAG-ответа.`);
      const context = relevantDocs.map(doc => `ИЗ ДОКУМЕНТА "${doc.metadata.source}":\n${doc.pageContent}`).join('\n\n---\n\n');
      
      finalPrompt = `
        Твоя роль - эксперт по документации ОСИ.
        Твоя задача - ответить на "Вопрос пользователя", основываясь ИСКЛЮЧИТЕЛЬНО на предоставленном "Контексте из документов".
        Не используй историю чата или свои общие знания. Только документы.
        Если в документах нет прямого ответа, скажи: "В предоставленных документах нет точной информации по этому вопросу."
        Отвечай на языке (${language}).

        Контекст из документов:
        ---
        ${context}
        ---
        Вопрос пользователя: "${prompt}"
      `;
    } else {
      // **ПОТОК Б: РЕЖИМ "УМНОГО СОБЕСЕДНИКА" (ТВОЙ ПРОМПТ)**
      // Этот промпт будет использоваться во всех остальных случаях, когда нужно вести диалог.
      console.log('[AI Service] Релевантных документов не найдено. Включаю режим обычного чата.');
      
      const contextForPrompt = 'Для этого запроса релевантной информации в документах не найдено.';
      
      finalPrompt = `
        Твоя роль - "NeoOSI", умный и полезный AI-ассистент для жителей и управляющих ОСИ в Казахстане. Твоя главная задача - вести осмысленный, последовательный диалог и помогать пользователю.

        **ТВОЙ ГЛАВНЫЙ ПРИОРИТЕТ - ИСТОРИЯ ЧАТА.**

        ПЛАН ТВОИХ ДЕЙСТВИЙ:
        1.  **Всегда** начинай с анализа "Истории чата", чтобы понять, о чем идет речь. Твой ответ должен быть логичным продолжением диалога. Не теряй нить разговора.
        2. Проанализируй "Вопрос пользователя" как **продолжение** этой истории.
        3.  **Только после этого** посмотри в "Контекст из документов". Используй его как **вспомогательный справочник**, чтобы уточнить детали или найти факты, если это требуется по контексту диалога.
        4.  Если пользователь просто отвечает на твой предыдущий вопрос (например, "Дом" в ответ на "какое имущество?"), **продолжай предыдущий диалог**, а не начинай новый.
        5. Проанализируй "Вопрос пользователя". **Самостоятельно определи основной язык вопроса** (казахский или русский), даже если он написан латиницей или смешанно ("шала-казахский").
        6. **Твой ответ ВСЕГДА должен быть на том языке, на котором задан вопрос.** Моя предварительная оценка языка - (${language}), но доверяй своему анализу. МАКСИМАЛЬНО АНАЛИЗИРУЙ НАПИСАННЫЙ ПОЛЬЗОВАТЕЛЕМ ТЕКСТ И ПЫТАЙСЯ ПОНЯТЬ ЯЗЫК СООБЩЕНИЯ. Если пользователь просит "давай на казахском", ты ОБЯЗАН переключиться.
        7. **Сначала** попробуй найти ответ в предоставленном "Контексте из документов". Если вопрос касается правил, законов или требует точных данных — это твой главный источник.
        8. **Если в документах нет ответа**, не говори "Я не знаю". Ответь на вопрос, используя "Историю чата" (если это уместно, например, "какой был мой последний вопрос?") или свои общие знания по теме ЖКХ и ОСИ.
        9. Если вопрос общий (например, "как дела?"), просто поддерживай дружелюбный разговор.

        ВАЖНО: Ты **всегда** должен помнить предыдущие сообщения из "Истории чата". Не говори, что у тебя нет доступа к предыдущим запросам.

        Контекст из документов (используй, если релевантно):
        ---
        ${contextForPrompt}
        ---
        Вопрос пользователя: "${prompt}"
      `;
    }
    
    return this.generateWithRetry(finalPrompt, history);
  }

  /**
   * Определяет основное намерение пользователя: начать генерацию документа или просто пообщаться.
   * @param prompt - Запрос пользователя.
   * @param userId - ID пользователя для доступа к истории чата.
   * @returns Объект с типом намерения ('chat' или 'start_generation') и полезной нагрузкой (ответ или имя шаблона).
   */
  async getAiResponse(prompt: string, user: User): Promise<{ type: 'chat' | 'start_generation'; content: any }> {
    try {
      console.log(`[AiService] Начинаю обработку для userId: ${user.id}`); 
      const languageHint = this.detectLanguage(prompt);
      const history = await this.chatHistoryService.getHistory(user.id);
      
      const intentDetectionPrompt = `
      Твоя задача - проанализировать "Запрос пользователя" и определить его намерение.

      ШАГ 1: Найди в "Списке шаблонов" ВСЕ шаблоны, которые могут соответствовать запросу.
      ШАГ 2: Прими решение:
      - Если найден ТОЛЬКО ОДИН подходящий шаблон -> верни JSON: {"intent": "start_generation", "templateName": "имя_найденного_файла.docx"}
      - Если найдено НЕСКОЛЬКО подходящих шаблонов (например, по слову "акт") ИЛИ НЕ НАЙДЕНО НИ ОДНОГО -> верни JSON: {"intent": "chat_response"}
      - Если это просто вопрос или приветствие -> верни JSON: {"intent": "chat_response"}

      ЗАПРЕЩЕНО возвращать что-либо, кроме указанных JSON-объектов.

      Список шаблонов:
      ${this._templateNames.map(t => `- "${t.humanName}" (файл: ${t.fileName})`).join('\n')}
      
      Запрос пользователя: "${prompt}"
    `;
      
      const rawResponse = await this.generateWithRetry(intentDetectionPrompt, history);
      const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.intent === 'start_generation' && parsed.templateName) {
          const foundTemplate = this._templateNames.find(t => t.fileName === parsed.templateName.toLowerCase());
          if (foundTemplate) {
            const confirmationMessage = this.currentLanguage === 'kz' ? `Әрине, "${foundTemplate.humanName}" құжатын дайындауға көмектесемін.` : `Конечно, я помогу вам подготовить документ: "${foundTemplate.humanName}".`;
            await this.chatHistoryService.addMessageToHistory(user.id, prompt, confirmationMessage);
            return { type: 'start_generation', content: foundTemplate.fileName };
          }
        }
      }
      
      const answer = await this.getFactualAnswer(prompt, history as Content[], this.currentLanguage);
      await this.chatHistoryService.addMessageToHistory(user.id, prompt, answer);
      return { type: 'chat', content: answer };

    } catch (error) {
      console.error('[AI Service] Ошибка в getAiResponse:', error);
      const errorMessage = this.currentLanguage === 'kz' ? 'Кешіріңіз, қате пайда болды.' : 'Извините, произошла ошибка.';
      await this.chatHistoryService.addMessageToHistory(user.id, prompt, errorMessage);
      return { type: 'chat', content: errorMessage };
    }
  }

  /**
   * Анализирует PDF-превью шаблона и генерирует список вопросов для пользователя на нужном языке.
   * @param templateName - Имя файла шаблона.
   * @returns Массив объектов с полями 'tag' (для машины) и 'question' (для человека).
   */
  async getFieldsForTemplate(templateName: string): Promise<any> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];
    if (!templateInfo || !templateInfo.tags_in_template || !templateInfo.language) {
        throw new Error(`Ошибка конфигурации: Шаблон "${templateName}" не настроен (отсутствуют теги или язык).`);
    }
    try {
        const pdfPreviewPath = path.join(process.cwd(), 'knowledge_base', 'templates', 'pdf_previews', normalizedTemplateName.replace('.docx', '.pdf'));
        if (!fs.existsSync(pdfPreviewPath)) {
            throw new Error(`PDF-превью для шаблона "${normalizedTemplateName}" не найдено.`);
        }
        const pdfBuffer = fs.readFileSync(pdfPreviewPath);
        const base64Pdf = pdfBuffer.toString('base64');
        const prompt = `
          Твоя главная задача: Сгенерировать список вопросов для пользователя на основе PDF-документа.
          САМОЕ ГЛАВНОЕ ПРАВИЛО: Язык для ВСЕХ генерируемых вопросов ДОЛЖЕН БЫТЬ "${templateInfo.language}". Не используй никакой другой язык, кроме указанного.
          Твоя цель - помочь пользователю заполнить шаблон. Проанализируй PDF и для каждого поля, которое нужно заполнить, сформулируй вежливый и понятный вопрос.
          Верни ответ СТРОГО в виде JSON-массива объектов, где каждый объект имеет два поля: "tag" и "question".
          Особое правило для тегов-массивов: Если в списке тегов есть тег, обозначающий массив (например, "documents"), задай ОДИН, ПОДРОБНЫЙ вопрос для этого родительского тега.
          Список всех тегов, которые ты должен учесть:
          ${templateInfo.tags_in_template.map(tag => `- ${tag}`).join('\n')}
        `;
        const result = await this.generateWithRetry([{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }]);
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        if (!jsonMatch) {
          console.error("AI не вернул валидный JSON-массив. Ответ:", result);
          throw new Error("Не удалось распарсить JSON-массив от AI.");
        }
        const cleanResponse = jsonMatch[0]
        return JSON.parse(cleanResponse);
    } catch (error) {
      console.error(`[AI Service] Ошибка при анализе шаблона ${templateName}:`, error);
      throw new Error('Не удалось проанализировать шаблон документа.');
    }
  }

  /**
   * Форматирует JSON-массив вопросов в красивый, читаемый текст для отображения пользователю.
   * @param fields - Массив вопросов, сгенерированный getFieldsForTemplate.
   * @param templateName - Имя файла шаблона для получения его "человеческого" названия.
   * @returns Единая форматированная строка с вопросами.
   */
  async formatQuestionsForUser(fields: any[], templateName: string): Promise<string> {
    const templateHumanName = TEMPLATES_REGISTRY[templateName.toLowerCase()]?.name || templateName;
    const language = TEMPLATES_REGISTRY[templateName.toLowerCase()]?.language || 'ru';

    const title = language === 'kz'
      ? `'${templateHumanName}' құжатын толтыру үшін келесі ақпарат қажет:`
      : `Для заполнения документа '${templateHumanName}' потребуется следующая информация:`;

    
      const prompt = `
      Ты чат-бот-помощник. Из следующего JSON-массива вопросов сформируй красивый, форматированный текст для пользователя.
      Текст должен быть вежливым и понятным.
      ВАЖНОЕ ПРАВИЛО ЯЗЫКА: Весь текст ответа (вопросы, примеры) должен быть на том же языке (${language}), на котором сформулированы "question" в JSON. Не переводи их.
      
      Начни с заголовка: "${title}"
      
      Не используй Markdown. Не включай вводных слов вроде "Конечно, вот...".

      JSON-массив с вопросами:
      ${JSON.stringify(fields, null, 2)}
    `;
    return this.generateWithRetry(prompt);
  }

  /**
   * Извлекает структурированные данные из ответа пользователя, используя жесткий промпт.
   * @param userAnswersPrompt - Текст ответа пользователя, содержащий данные.
   * @param templateName - Имя файла шаблона, для которого извлекаются данные.
   * @returns Объект с флагом isComplete, извлеченными данными (data) и списком недостающих полей (missingFields).
   */
  async extractDataForDocx(userAnswersPrompt: string, templateName: string): Promise<{ data: any; isComplete: boolean; missingFields?: { tag: string; question: string }[] }> {
    const normalizedTemplateName = templateName.toLowerCase();
    const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];
    if (!templateInfo || !templateInfo.tags_in_template) {
        throw new Error(`Шаблон "${templateName}" не найден или не настроен.`);
    }
    const requiredTags = templateInfo.tags_in_template;
    // --- ФИНАЛЬНАЯ ВЕРСИЯ ПРОМПТА С УТОЧНЕНИЕМ ДЛЯ МАССИВОВ ---
    const prompt = `
    Твоя роль - высокоточный робот по извлечению структурированных данных (Data Extractor). Твоя работа критически важна. Ошибки недопустимы.
    
    ТЫ ДОЛЖЕН СЛЕДОВАТЬ ЭТИМ ШАГАМ:
    ШАГ 1: Внимательно проанализируй 'Текст для анализа' от пользователя.
    ШАГ 2: Проанализируй 'Список требуемых тегов'.
    ШАГ 3: Последовательно, для КАЖДОГО тега из списка, найди соответствующее ему значение в тексте.
    ШАГ 4: Сформируй ПОЛНЫЙ JSON-объект с извлеченными данными.

    **--- НОВОЕ КЛЮЧЕВОЕ ПРАВИЛО ---**
    **"isComplete" должно быть 'true' ТОЛЬКО И ИСКЛЮЧИТЕЛЬНО ТОГДА, когда ты нашел значения для ВСЕХ тегов из списка. Если ты не нашел значение хотя бы для ОДНОГО тега, "isComplete" ДОЛЖНО быть 'false', а сам тег должен быть в массиве "missingFields".**
    
    КАТЕГОРИЧЕСКИ ЗАПРЕЩАЕТСЯ возвращать "isComplete": false, если все данные присутствуют в тексте. Ты должен найти их.
    
    ВАЖНОЕ ПРАВИЛО ДЛЯ ТАБЛИЦ/СПИСКОВ: Если тег обозначает массив (например, 'docs' или 'commission_members'), ты ОБЯЗАН вернуть массив ОБЪЕКТОВ, где ключи объектов - это теги из цикла в шаблоне. Смотри пример.
    
    ПРИМЕР ВЫПОЛНЕНИЯ ЗАДАЧИ:
    ---
    Пример 'Текста для анализа': "Адрес объекта: г. Астана, ул. Достык, 5. Прилагаются: 1. Техпаспорт (12 листов), 2. Проект (45 листов)."
    Пример 'Списка требуемых тегов': ["property_address", "docs", "doc_name", "doc_sheets"]
    Твой ПРАВИЛЬНЫЙ РЕЗУЛЬТАТ:
    {
      "isComplete": true,
      "missingFields": [],
      "data": {
        "property_address": "г. Астана, ул. Достык, 5",
        "docs": [
          { "doc_name": "Техпаспорт", "doc_sheets": "12" },
          { "doc_name": "Проект", "doc_sheets": "45" }
        ]
      }
    }
    ---
    **--- ВТОРОЙ ПРИМЕР ДЛЯ СЛОЖНЫХ СЛУЧАЕВ ---**
    Пример 'Текста для анализа': "Хочу оформить акт приема-передачи технической документации"
    Пример 'Списка требуемых тегов': ["property_address", "transferor_details", "acceptor_details"]
    Твой ПРАВИЛЬНЫЙ РЕЗУЛЬТАТ:
    {
      "isComplete": false,
      "missingFields": ["property_address", "transferor_details", "acceptor_details"],
      "data": {}
    }
    ---
    
    Теперь выполни задачу для реальных данных.
    
    Список требуемых тегов для извлечения:
    ${JSON.stringify(requiredTags, null, 2)}
    
    Текст для анализа:
    "${userAnswersPrompt}"
    
    Верни ответ СТРОГО в формате JSON. Без пояснений и \`\`\`json.
    `;

    try {
        const rawResponse = await this.generateWithRetry(prompt);

        // --- ГЛАВНОЕ ИСПРАВЛЕНИЕ ---
        // Используем регулярное выражение для поиска JSON-блока в ответе.
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);

        // Если JSON-блок не найден вообще, это критическая ошибка.
        if (!jsonMatch) {
          console.error("AI не вернул валидный JSON в ответе. Ответ модели:", rawResponse);
          throw new Error("Не удалось извлечь данные из ответа AI.");
        }

        // Берем только совпавшую часть (чистый JSON) и парсим ее.
        const parsedResponse = JSON.parse(jsonMatch[0]);
        
        if (parsedResponse.isComplete === false && !parsedResponse.missingFields) {
            console.warn("AI указал на неполные данные, но не предоставил список недостающих полей. Повторно запрашиваем все поля.");
            const fields = await this.getFieldsForTemplate(templateName);
            parsedResponse.missingFields = fields;
        }
        return parsedResponse;

    } catch (error) {
        console.error('Критическая ошибка при извлечении данных:', error);
        const fields = await this.getFieldsForTemplate(templateName);
        return { isComplete: false, missingFields: fields, data: {} };
    }
  }

  /**
   * Анализирует сообщение пользователя, когда он уже находится в режиме сбора данных, для реализации гибкого диалога.
   * @param prompt - Сообщение пользователя.
   * @param currentTemplateName - Имя шаблона, который сейчас заполняется.
   * @returns Объект с определенным намерением ('provide_data', 'switch_document', 'general_query').
   */
  async analyzeInputDuringDataCollection(prompt: string, currentTemplateName: string): Promise<{ intent: 'provide_data' | 'switch_document' | 'general_query'; templateName?: string }> {
    const intentAnalysisPrompt = `
      Твоя задача - проанализировать сообщение пользователя, который сейчас заполняет документ "${currentTemplateName}". Определи его намерение.
      Возможные намерения:
      1. "provide_data": Пользователь предоставляет запрошенные данные.
      2. "switch_document": Пользователь хочет отменить текущий процесс и начать заполнять ДРУГОЙ документ.
      3. "general_query": Сообщение не является ни данными, ни запросом на смену документа (вопрос, отмена, приветствие).
      Список ВСЕХ доступных документов:
      ${this._templateNames.map(t => `- "${t.humanName}" (файл: ${t.fileName})`).join('\n')}
      Проанализируй запрос и верни ТОЛЬКО JSON:
      - Если это данные: {"intent": "provide_data"}
      - Если это смена документа: {"intent": "switch_document", "templateName": "точное_имя_файла.docx"}
      - Если общий вопрос: {"intent": "general_query"}
      Запрос пользователя: "${prompt}"
    `;
    const rawResponse = await this.generateWithRetry(intentAnalysisPrompt);
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    // Если модель не смогла определить намерение, по умолчанию считаем, что это данные (самый вероятный сценарий).
    return { intent: 'provide_data' };
  }
}