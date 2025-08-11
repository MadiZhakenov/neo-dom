

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
import { ChatType } from '../chat/entities/chat-message.entity';
import { User } from '../users/entities/user.entity'; // <-- ИСПРАВЛЕНИЕ
import { UsersService } from '../users/users.service'; // <-- ИСПРАВЛЕНИЕ
import { DocxService } from '../documents/docx/docx.service'; // <-- ИСПРАВЛЕНИЕ
import * as crypto from 'crypto';
import { ChatAiService } from './chat-ai.service';
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

@Injectable()
export class DocumentAiService implements OnModuleInit {
    private primaryModel: any;
    private fallbackModel: any;
    private vectorStore: MemoryVectorStore;
    private _templateNames: { fileName: string; humanName: string }[];
    private currentLanguage: 'ru' | 'kz' = 'ru';

    constructor(
        private readonly configService: ConfigService,
        private readonly chatHistoryService: ChatHistoryService,
        private readonly usersService: UsersService,
        private readonly docxService: DocxService,
        private readonly chatAiService: ChatAiService,

    ) { }

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
    public detectLanguage(text: string): 'ru' | 'kz' {
        const kzSpecificChars = /[әғқңөұүіһӘҒҚҢӨҰҮІҺ]/;
        if (kzSpecificChars.test(text)) { return 'kz'; }
        const kzCommonWords = /(және|немесе|туралы|бойынша|бастап|дейін|үшін|арқылы)/i;
        if (kzCommonWords.test(text)) { return 'kz'; }
        return 'ru';
    }

    // Замените старый метод processDocumentMessage на этот
    async processDocumentMessage(prompt: string, user: User): Promise<{ type: 'chat' | 'file'; content: any; fileName?: string }> {
        const userId = user.id;
        const language = this.detectLanguage(prompt);

        // БЛОК 1: ПОЛЬЗОВАТЕЛЬ УЖЕ В ПРОЦЕССЕ ЗАПОЛНЕНИЯ
        if (user.doc_chat_template) {
            const extractionResult = await this.extractDataForDocx(prompt, user.doc_chat_template);

            // Если пользователь решил отменить или задать отвлеченный вопрос
            if (extractionResult.intent) {
                await this.usersService.resetDocChatState(userId);
                const intentResult = await this.findTemplate(prompt, userId); // Перепроверяем намерение уже с чистым состоянием
                return this.handleClarification(intentResult, language);
            }

            // Если это были данные для заполнения
            if (extractionResult.isComplete) {
                const docxBuffer = this.docxService.generateDocx(user.doc_chat_template, extractionResult.data);
                await this.usersService.resetDocChatState(userId);
                if (user.tariff === 'Базовый') { await this.usersService.setLastGenerationDate(user.id, new Date()); }
                return { type: 'file', content: docxBuffer, fileName: user.doc_chat_template };
            }

            // Если данные неполные
            const missingTags = extractionResult.missingFields;
            if (missingTags && Array.isArray(missingTags) && missingTags.length > 0) {
                const allFields = await this.getFieldsForTemplate(user.doc_chat_template);
                const missingFieldsWithQuestions = allFields.filter(field => missingTags.includes(field.tag));
                const missingQuestions = missingFieldsWithQuestions.map(f => f.question).join('\n- ');
                return { type: 'chat', content: { action: 'collect_data', message: `Для завершения, предоставьте:\n\n- ${missingQuestions}` } };
            }
        }

        // БЛОК 2: ПОИСК ШАБЛОНА ДЛЯ НОВОГО ЗАПРОСА
        const intentResult = await this.findTemplate(prompt, userId);

        if (intentResult.templateName) {
            const questions = await this.getQuestionsForTemplate(intentResult.templateName);
            await this.usersService.setDocChatState(userId, intentResult.templateName, crypto.randomBytes(16).toString('hex'));
            return { type: 'chat', content: questions };
        }

        // Если намерение - не поиск документа, а что-то другое
        return this.handleClarification(intentResult, language);
    }

    // Добавьте этот новый вспомогательный метод в класс
    private handleClarification(intentResult: any, language: 'ru' | 'kz'): { type: 'chat', content: any } {
        let message = "";

        const smallTalk = {
            ru: "Здравствуйте! Я ваш ИИ-помощник по документам. Я могу помочь вам создать нужный документ. Всегда напоминаю: если у вас общие вопросы, лучше задать их в 'ИИ-Чате'.",
            kz: "Сәлеметсіз бе! Мен сіздің құжаттар бойынша ЖИ-көмекшіңізбін. Мен сізге қажетті құжатты жасауға көмектесе аламын. Егер жалпы сұрақтарыңыз болса, оларды 'ЖИ-Чат' терезесінде қойғаныңыз жөн."
        };

        const queryRedirect = {
            ru: "Это похоже на общий вопрос. Для консультаций, пожалуйста, воспользуйтесь 'ИИ-Чатом'. Здесь я помогаю только с созданием документов.",
            kz: "Бұл жалпы сұраққа ұқсайды. Кеңес алу үшін 'ЖИ-Чат' терезесін пайдаланыңыз. Мұнда мен тек құжаттарды жасауға көмектесемін."
        };

        if (intentResult.intent === 'query') {
            message = queryRedirect[language];
        } else if (intentResult.intent === 'small_talk') {
            message = smallTalk[language] + "\n\n" + this._getFormattedTemplateList(language);
        } else { // 'clarification_needed', 'cancel', etc.
            message = (intentResult.clarification || (language === 'kz' ? "Қандай құжат керектігін нақтылаңызшы." : "Уточните, какой документ вам нужен?")) + "\n\n" + this._getFormattedTemplateList(language);
        }

        return { type: 'chat', content: { action: 'clarification', message } };
    }

    private _getFormattedTemplateList(language: 'ru' | 'kz'): string {
        const header = language === 'kz'
            ? "Міне, қолжетімді құжаттар тізімі:\n\n"
            : "Вот список доступных документов:\n\n";

        const templateList = this._templateNames
            .map(t => `* ${t.humanName}`)
            .join('\n');
        return header + templateList;
    }

    private async getQuestionsForTemplate(templateName: string): Promise<any> {
        const fields = await this.getFieldsForTemplate(templateName);
        const questions = await this.formatQuestionsForUser(fields, templateName);
        return { action: 'collect_data', templateName, questions };
    }

    private async findTemplate(prompt: string, userId: number): Promise<{ templateName?: string; clarification?: string, intent?: string }> {
        const history = await this.chatHistoryService.getHistory(userId, ChatType.DOCUMENT);
        const language = this.detectLanguage(prompt);

        const smallTalk = {
            ru: "Привет! Я ваш ИИ-помощник по документам. Какой документ вы хотели бы создать?",
            kz: "Сәлем! Мен сіздің құжаттар бойынша ЖИ-көмекшіңізбін. Қандай құжат жасағыңыз келеді?"
        };

        // Внутри метода findTemplate
        const intentDetectionPrompt = `
  Твоя задача - классифицировать "Запрос" пользователя на языке "${language}". Действуй СТРОГО по плану.

  ПЛАН ДЕЙСТВИЙ:
  1.  **ПРОВЕРКА НА ОБЩИЙ ВОПРОС (QUERY):** Если "Запрос" - это жалоба, вопрос не по теме, утверждение или бессмысленный набор слов (например, "сосед затопил", "кто несет ответственность", "пофиг", "мда", "устидеги коршиден су басты"), **НЕМЕДЛЕННО** верни JSON: {"intent": "query"}
  2.  **ПРОВЕРКА НА ПРИВЕТСТВИЕ (SMALL TALK):** Если "Запрос" - это только приветствие ("привет", "салем", "hello") или вопрос о тебе ("кто ты?", "кімсің сен"), верни JSON: {"intent": "small_talk"}
  3.  **ПРОВЕРКА НА ОТМЕНУ (CANCEL):** Если "Запрос" содержит явную отмену ("отмена", "не хочу", "керек жок", "передумал"), верни JSON: {"intent": "cancel"}
  4.  **ПОИСК ШАБЛОНА:** Если ничего из вышеперечисленного не подошло, значит, пользователь пытается назвать документ.
      -   Если ты находишь в запросе ОДИН подходящий шаблон -> верни JSON: {"templateName": "имя_файла.docx"}
      -   Иначе (если не нашел или нашел несколько) -> верни JSON: {"intent": "clarification_needed"}

  Список шаблонов для поиска: ${this._templateNames.map(t => t.humanName).join(', ')}
  Запрос: "${prompt}"
  Верни ТОЛЬКО JSON.
`;

        const rawResponse = await this.generateWithRetry(intentDetectionPrompt);
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { return { intent: "clarification_needed" }; }
        return JSON.parse(jsonMatch[0]);
    }


    /**
      * Шаг 1: Находит подходящий шаблон и возвращает список вопросов.
      * @param prompt - Запрос пользователя.
      * @param userId - ID пользователя.
      * @returns Объект с вопросами или сообщение с вариантами.
      */
    async startDocumentGeneration(prompt: string, userId: number): Promise<any> {
        const language = this.detectLanguage(prompt);
        const history = await this.chatHistoryService.getHistory(userId, ChatType.DOCUMENT);

        const intentDetectionPrompt = `
      Твоя задача - найти в "Списке шаблонов" тот, который лучше всего соответствует "Запросу пользователя".
      - ЕСЛИ найден ОДИН подходящий шаблон -> верни ТОЛЬКО JSON: {"templateName": "имя_файла.docx"}
      - ЕСЛИ найдено НЕСКОЛЬКО подходящих шаблонов или НЕ НАЙДЕНО НИ ОДНОГО -> верни ТОЛЬКО JSON: {"templateName": null, "clarification": "текст_уточняющего_вопроса_с_вариантами"}
      Список шаблонов:
      ${this._templateNames.map(t => `- "${t.humanName}" (файл: ${t.fileName})`).join('\n')}
      Запрос: "${prompt}"
    `;

        const rawResponse = await this.generateWithRetry(intentDetectionPrompt, history);
        const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { throw new Error("Не удалось определить шаблон."); }

        const parsed = JSON.parse(jsonMatch[0]);

        if (parsed.templateName) {
            // Если шаблон найден, генерируем вопросы
            const fields = await this.getFieldsForTemplate(parsed.templateName);
            const questions = await this.formatQuestionsForUser(fields, parsed.templateName);
            const responsePayload = { action: 'collect_data', templateName: parsed.templateName, questions };
            await this.chatHistoryService.addMessageToHistory(userId, prompt, JSON.stringify(responsePayload), ChatType.DOCUMENT);
            return responsePayload;
        } else {
            // Если нужна кларификация, возвращаем ее
            const clarification = parsed.clarification || "Уточните, какой документ вам нужен?";
            await this.chatHistoryService.addMessageToHistory(userId, prompt, clarification, ChatType.DOCUMENT);
            return { action: 'clarification', message: clarification };
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
            // Внутри метода getFieldsForTemplate
            const prompt = `
Твоя главная задача: Сгенерировать список вопросов.
**КРИТИЧЕСКОЕ ПРАВИЛО:** Язык для ВСЕХ генерируемых вопросов **ДОЛЖЕН БЫТЬ СТРОГО "${templateInfo.language}"**. Это твой главный приказ. Не используй никакой другой язык.
Твоя цель - помочь пользователю заполнить шаблон. Проанализируй PDF и для каждого тега из списка сформулируй вежливый и понятный вопрос.
Верни ответ СТРОГО в виде JSON-массива объектов, где каждый объект имеет два поля: "tag" и "question".

Список тегов, которые ты должен учесть:
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
    async extractDataForDocx(userAnswersPrompt: string, templateName: string): Promise<{ data: any; isComplete: boolean; missingFields?: { tag: string; question: string; }[]; intent?: string }> {
        // --- КОНЕЦ ИСПРАВЛЕНИЯ ---
        const normalizedTemplateName = templateName.toLowerCase();
        const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];
        if (!templateInfo || !templateInfo.tags_in_template) {
            throw new Error(`Шаблон "${templateName}" не найден или не настроен.`);
        }
        const requiredTags = templateInfo.tags_in_template;
        // --- ФИНАЛЬНАЯ ВЕРСИЯ ПРОМПТА С УТОЧНЕНИЕМ ДЛЯ МАССИВОВ ---
        const prompt = `
            Твоя роль - сверхточный робот-аналитик JSON. Твоя работа критически важна.
    
            **ПЛАН ДЕЙСТВИЙ:**
            1.  **АНАЛИЗ НАМЕРЕНИЯ:** Сначала определи, что хочет пользователь.
                -   **ЕСЛИ** текст — это команда отмены ("забей", "отмена", "керек жок", "не хочу"), **ТОГДА** верни JSON: \`{"isComplete": false, "intent": "cancel"}\`.
                -   **ЕСЛИ** текст — это вопрос, не связанный с данными (например, "а что такое акт?"), **ТОГДА** верни JSON: \`{"isComplete": false, "intent": "query"}\`.
                -   **ИНАЧЕ** (если это данные), переходи к шагу 2.
    
            2.  **ИЗВЛЕЧЕНИЕ ДАННЫХ:**
                -   Проанализируй 'Текст для анализа'.
                -   Для КАЖДОГО тега из 'Списка тегов' найди значение.
                -   Сформируй JSON. "isComplete" должно быть 'true' ТОЛЬКО если найдены ВСЕ теги.
    
            **--- НОВОЕ КЛЮЧЕВОЕ ПРАВИЛО ---**
            **"isComplete" должно быть 'true' ТОЛЬКО И ИСКЛЮЧИТЕЛЬНО ТОГДА, когда ты нашел значения для ВСЕХ тегов из списка. Если ты не нашел значение хотя бы для ОДНОГО тега, "isComplete" ДОЛЖНО быть 'false', а сам тег должен быть в массиве "missingFields".**
            
            // --- НАЧАЛО ДОПОЛНЕНИЯ ---
            **ПРАВИЛО ГИБКОСТИ И ВНИМАТЕЛЬНОСТИ:**
            Пользователь может предоставить всю информацию в одном большом сообщении. Твоя задача — **внимательно прочитать ВЕСЬ текст** и не "теряться". Даже если текст длинный, ты ОБЯЗАН найти все данные, если они там есть. Не сдавайся на полпути.
            // --- КОНЕЦ ДОПОЛНЕНИЯ ---
    
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
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("AI не вернул валидный JSON. Ответ:", rawResponse);
                throw new Error("Не удалось извлечь данные.");
            }

            let parsedResponse: any;
            try {
                parsedResponse = JSON.parse(jsonMatch[0]);
            } catch (parseError) {
                console.error("Ошибка парсинга JSON от AI:", parseError, "Ответ модели:", jsonMatch[0]);
                throw new Error("Не удалось обработать ответ AI.");
            }

            // Если AI говорит, что данные неполные, но не говорит, какие именно,
            // мы запрашиваем у него полный список вопросов заново.
            if (parsedResponse.isComplete === false && (!parsedResponse.missingFields || parsedResponse.missingFields.length === 0)) {
                // Добавим проверку на intent, чтобы не запрашивать поля при отмене
                if (parsedResponse.intent !== 'cancel' && parsedResponse.intent !== 'query') {
                    console.warn("AI указал на неполные данные, но не предоставил список. Запрашиваем все поля заново.");
                    const allFields = await this.getFieldsForTemplate(templateName);
                    parsedResponse.missingFields = allFields;
                }
            }

            return parsedResponse;

        } catch (error) {
            console.error('Критическая ошибка при извлечении данных:', error);
            // В случае любой ошибки, мы не падаем, а вежливо просим пользователя
            // предоставить данные заново, показывая ему все вопросы.
            const allFields = await this.getFieldsForTemplate(templateName);
            return { isComplete: false, missingFields: allFields, data: {} };
        }
    }


}