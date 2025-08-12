// src\ai\document-ai.service.ts 

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
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneratedDocument } from 'src/documents/entities/generated-document.entity';
import { v4 as uuidv4 } from 'uuid';
const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

type DocumentProcessingResponse = {
    type: 'chat' | 'file';
    content: any;
    fileName?: string;
    historyContent?: string; // <--- Вот недостающее поле
};

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
        @InjectRepository(GeneratedDocument)
        private readonly generatedDocRepo: Repository<GeneratedDocument>,

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

    private async generateWithRetry(prompt: any, retries = 3): Promise<string> {
        let lastError: any;

        // --- Попытка 1: Основная, самая мощная модель ---
        try {
            console.log(`[AI Service] Обращение к основной модели (gemini-1.5-pro)...`);
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const result = await this.primaryModel.generateContent(prompt);
                    return result.response.text();
                } catch (error) {
                    if (error.status === 503 && attempt < retries) {
                        const waitTime = Math.pow(2, attempt) * 1000; // 2, 4, 8 секунд
                        console.warn(`[AI Service] Основная модель перегружена (503). Повторная попытка через ${waitTime / 1000} сек...`);
                        await delay(waitTime);
                    } else {
                        throw error; // Выбрасываем ошибку, если она не 503 или попытки кончились
                    }
                }
            }
        } catch (error) {
            console.error(`[AI Service] Основная модель не ответила после всех попыток. Ошибка:`, error.message);
            lastError = error;
        }

        // --- Попытка 2: Резервная, более быстрая модель ---
        try {
            console.warn(`[AI Service] Переключаюсь на резервную модель (gemini-1.5-flash)...`);
            for (let attempt = 1; attempt <= retries; attempt++) {
                try {
                    const result = await this.fallbackModel.generateContent(prompt);
                    return result.response.text();
                } catch (error) {
                    if (error.status === 503 && attempt < retries) {
                        const waitTime = Math.pow(2, attempt) * 1000;
                        console.warn(`[AI Service] Резервная модель перегружена (503). Повторная попытка через ${waitTime / 1000} сек...`);
                        await delay(waitTime);
                    } else {
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error(`[AI Service] Резервная модель также не ответила. Ошибка:`, error.message);
            lastError = error;
        }

        // Если ни одна из моделей не ответила
        throw lastError || new Error('Не удалось получить ответ от AI после всех попыток со всеми моделями.');
    }

    public detectLanguage(text: string): 'ru' | 'kz' {
        const kzSpecificChars = /[әғқңөұүіһӘҒҚҢӨҰҮІҺ]/;
        if (kzSpecificChars.test(text)) { return 'kz'; }
        const kzCommonWords = /(және|немесе|туралы|бойынша|бастап|дейін|үшін|арқылы)/i;
        if (kzCommonWords.test(text)) { return 'kz'; }
        return 'ru';
    }

    // Замените старый метод processDocumentMessage на этот
    // async processDocumentMessage(prompt: string, user: User): Promise<DocumentProcessingResponse> {
    //     const userId = user.id;
    //     const language = this.detectLanguage(prompt);

    //     // БЛОК 1: ПОЛЬЗОВАТЕЛЬ УЖЕ В ПРОЦЕССЕ ЗАПОЛНЕНИЯ
    //     if (user.doc_chat_template) {
    //         const extractionResult = await this.extractDataForDocx(prompt, user.doc_chat_template, userId);

    //         // Если пользователь решил отменить или задать отвлеченный вопрос
    //         if (extractionResult.intent) {
    //             await this.usersService.resetDocChatState(userId);
    //             const intentResult = await this.findTemplate(prompt); // Перепроверяем намерение уже с чистым состоянием
    //             return this.handleClarification(intentResult, language);
    //         }

    //         // Если это были данные для заполнения
    //         if (extractionResult.isComplete) {
    //             // --- НАЧАЛО БЛОКА ПРОВЕРКИ ЛИМИТОВ ---
    //             if (user.tariff === 'Базовый') {
    //                 const now = new Date();
    //                 if (user.last_generation_date) {
    //                     const lastGen = new Date(user.last_generation_date);
    //                     // Проверяем, была ли генерация в том же календарном месяце и году
    //                     if (lastGen.getFullYear() === now.getFullYear() && lastGen.getMonth() === now.getMonth()) {
    //                         const message = language === 'kz'
    //                             ? "Сіз осы айдағы тегін құжат жасау лимитіңізді пайдаланып қойдыңыз. Лимитсіз генерация үшін 'Премиум' тарифіне өтіңіз."
    //                             : "Вы уже использовали свой лимит на создание бесплатного документа в этом месяце. Для безлимитной генерации, пожалуйста, перейдите на тариф 'Премиум'.";

    //                         // Важно: также сбрасываем состояние, чтобы пользователь не застрял
    //                         await this.usersService.resetDocChatState(userId);
    //                         return { type: 'chat', content: { action: 'clarification', message } };
    //                     }
    //                 }
    //             }

    //             // --- КОНЕЦ БЛОКА ПРОВЕРКИ ЛИМИТОВ ---

    //             const docxBuffer = this.docxService.generateDocx(user.doc_chat_template, extractionResult.data);

    //             // --- НАЧАЛО ИЗМЕНЕНИЯ ПУТИ ---
    //             const fileId = uuidv4();
    //             // Используем абсолютный путь, который Render понимает для дисков
    //             const storageDir = `/var/data/render/generated_documents`;
    //             if (!fs.existsSync(storageDir)) {
    //                 fs.mkdirSync(storageDir, { recursive: true });
    //             }
    //             const storagePath = path.join(storageDir, `${fileId}.docx`);
    //             // --- КОНЕЦ ИЗМЕНЕНИЯ ПУТИ ---

    //             // Сохраняем метаданные в БД
    //             fs.writeFileSync(storagePath, docxBuffer);
    //             const newDoc = this.generatedDocRepo.create({ id: fileId, user: user, originalFileName: user.doc_chat_template, storagePath: storagePath });
    //             await this.generatedDocRepo.save(newDoc);
    //             // --- КОНЕЦ ЛОГИКИ СОХРАНЕНИЯ ФАЙЛА ---

    //             await this.usersService.resetDocChatState(userId);

    //             // Обновляем дату генерации ТОЛЬКО для базового тарифа после успешного создания
    //             if (user.tariff === 'Базовый') {
    //                 await this.usersService.setLastGenerationDate(user.id, new Date());
    //             }

    //             // --- ИЗМЕНЕНИЕ ОТВЕТА ДЛЯ ИСТОРИИ ЧАТА ---
    //             // Формируем специальный JSON для сохранения в историю чата
    //             const modelResponseContent = JSON.stringify({
    //                 message: `Документ "${user.doc_chat_template}" успешно сгенерирован.`,
    //                 fileId: fileId,
    //                 fileName: `${user.doc_chat_template}.docx`
    //             });

    //             // Этот контент будет сохранен в историю чата в контроллере
    //             // ВАЖНО: Мы должны передать его обратно в контроллер.
    //             // Для этого добавим его в возвращаемый объект, чтобы контроллер мог его прочитать.

    //             return {
    //                 type: 'file',
    //                 content: docxBuffer,
    //                 fileName: user.doc_chat_template,
    //                 // Добавляем специальное поле для истории чата
    //                 historyContent: modelResponseContent
    //             };
    //         }

    //         // Если данные неполные
    //         const missingTags = extractionResult.missingFields;
    //         if (missingTags && Array.isArray(missingTags) && missingTags.length > 0) {
    //             const allFields = await this.getFieldsForTemplate(user.doc_chat_template);

    //             // Эта строка теперь корректна, так как TypeScript знает, что missingTags - это string[]
    //             const missingFieldsWithQuestions = allFields.filter(field => missingTags.includes(field.tag));

    //             const missingQuestions = missingFieldsWithQuestions.map(f => f.question).join('\n- ');
    //             return { type: 'chat', content: { action: 'collect_data', message: `Для завершения, предоставьте:\n\n- ${missingQuestions}` } };
    //         }
    //     }

    //     // БЛОК 2: ПОИСК ШАБЛОНА ДЛЯ НОВОГО ЗАПРОСА
    //     const intentResult = await this.findTemplate(prompt);

    //     if (intentResult.templateName) {
    //         const questions = await this.getQuestionsForTemplate(intentResult.templateName);
    //         await this.usersService.setDocChatState(userId, intentResult.templateName, crypto.randomBytes(16).toString('hex'));
    //         return { type: 'chat', content: questions };
    //     }

    //     // Если намерение - не поиск документа, а что-то другое
    //     return this.handleClarification(intentResult, language);
    // }

    async processDocumentMessage(prompt: string, user: User): Promise<DocumentProcessingResponse> {
        const userId = user.id;
        const language = this.detectLanguage(prompt);

        // БЛОК 1: ПОШАГОВЫЙ ДИАЛОГ
        if (user.doc_chat_template) {
            const allFields = await this.getFieldsForTemplate(user.doc_chat_template);
            const currentIndex = user.doc_chat_question_index || 0;

            if (currentIndex >= allFields.length) {
                await this.usersService.resetDocChatState(userId);
                return this.handleClarification({ intent: 'clarification_needed' }, language);
            }

            const currentField = allFields[currentIndex];

            // --- ИЗМЕНЕНИЕ: Используем старый мощный extractDataForDocx, но с фокусом на одном вопросе ---
            // Он будет анализировать ВСЮ историю, но искать ответ на КОНКРЕТНЫЙ вопрос
            const extractionResult = await this.extractDataForDocx(prompt, user.doc_chat_template, userId, currentField.question, currentField.tag);

            if (extractionResult.intent) {
                await this.usersService.resetDocChatState(userId);
                const intentResult = await this.findTemplate(prompt);
                return this.handleClarification(intentResult, language);
            }

            if (extractionResult.error) {
                const retryMessage = `${extractionResult.error}\n\n${currentField.question}`;
                return { type: 'chat', content: { action: 'collect_data', message: retryMessage } };
            }

            const currentData = user.doc_chat_pending_data || {};
            const newData = { ...currentData, ...(extractionResult.data || {}) };
            const nextIndex = currentIndex + 1;

            if (nextIndex < allFields.length) {
                await this.usersService.updateDocChatState(userId, nextIndex, newData);
                const nextField = allFields[nextIndex];
                return { type: 'chat', content: { action: 'collect_data', message: nextField.question } };
            } else {
                const finalData = newData;

                // (Логика проверки лимитов и сохранения файла)
                if (user.tariff === 'Базовый') {
                    const now = new Date();
                    if (user.last_generation_date) {
                        const lastGen = new Date(user.last_generation_date);
                        if (lastGen.getFullYear() === now.getFullYear() && lastGen.getMonth() === now.getMonth()) {
                            const message = language === 'kz' ? "Сіздің тегін құжат жасау лимитіңіз бітті." : "Ваш лимит на бесплатные документы исчерпан.";
                            await this.usersService.resetDocChatState(userId);
                            return { type: 'chat', content: { action: 'clarification', message } };
                        }
                    }
                }

                const docxBuffer = this.docxService.generateDocx(user.doc_chat_template, finalData);
                const fileId = uuidv4();
                const storageDir = `/var/data/render/generated_documents`;
                if (!fs.existsSync(storageDir)) { fs.mkdirSync(storageDir, { recursive: true }); }
                const storagePath = path.join(storageDir, `${fileId}.docx`);
                fs.writeFileSync(storagePath, docxBuffer);
                const newDoc = this.generatedDocRepo.create({ id: fileId, user, originalFileName: user.doc_chat_template, storagePath });
                await this.generatedDocRepo.save(newDoc);

                await this.usersService.resetDocChatState(userId);
                if (user.tariff === 'Базовый') { await this.usersService.setLastGenerationDate(user.id, new Date()); }

                const modelResponseContent = JSON.stringify({ message: `Документ "${user.doc_chat_template}" успешно сгенерирован.`, fileId, fileName: user.doc_chat_template });

                return { type: 'file', content: docxBuffer, fileName: user.doc_chat_template, historyContent: modelResponseContent };
            }
        }

        // БЛОК 2: НАЧАЛО НОВОГО ДИАЛОГА
        const intentResult = await this.findTemplate(prompt);
        if (intentResult.templateName) {
            const allFields = await this.getFieldsForTemplate(intentResult.templateName);
            if (allFields && allFields.length > 0) {
                await this.usersService.startDocChat(user.id, intentResult.templateName);
                return { type: 'chat', content: { action: 'collect_data', message: allFields[0].question } };
            }
        }

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

    private async findTemplate(prompt: string): Promise<{ templateName?: string; intent?: string }> {
        const language = this.detectLanguage(prompt);
        
        const intentDetectionPrompt = `
          Твоя задача - точно классифицировать "Запрос" пользователя. Действуй СТРОГО по плану.
    
          **ПЛАН ДЕЙСТВИЙ:**
          1.  **ПРОВЕРКА НА ПРИВЕТСТВИЕ:** Если "Запрос" - это только приветствие ("Привет", "Салем"), верни JSON: {"intent": "small_talk"}
          2.  **ПРОВЕРКА НА ОТМЕНУ:** Если "Запрос" содержит явную отмену ("отмена", "не хочу", "керек жок"), верни JSON: {"intent": "cancel"}
          3.  **ПРОВЕРКА НА ОБЩИЙ ВОПРОС:** Если "Запрос" - это жалоба, вопрос не по теме ИЛИ утверждение, НЕ СВЯЗАННОЕ с документами (например, "сосед затопил", "погода хорошая", "кто ты?"), верни JSON: {"intent": "query"}
          4.  **ПОИСК ШАБЛОНА ИЛИ НАМЕРЕНИЯ РАБОТАТЬ С ДОКУМЕНТАМИ:**
              -   Если в запросе **однозначно указан ОДИН шаблон** из списка -> верни JSON с **ИМЕНЕМ ФАЙЛА**: {"templateName": "имя_файла_из_списка.docx"}
              -   Если запрос выражает **общее желание создать документ**, но не указывает какой именно (например, "хочу новый документ", "давай заполнять", "какие есть документы?"), верни JSON: {"intent": "clarification_needed"}
              -   Во всех остальных случаях (если не нашел или нашел несколько) -> верни JSON: {"intent": "clarification_needed"}
    
          **Список шаблонов (формат: "человеческое имя" (имя файла)):**
          ${this._templateNames.map(t => `- "${t.humanName}" (${t.fileName})`).join('\n')}
          
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

        const rawResponse = await this.generateWithRetry(intentDetectionPrompt);
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
    async getFieldsForTemplate(templateName: string): Promise<{ tag: string, question: string }[]> {
        const normalizedTemplateName = templateName.toLowerCase();
        const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];
        if (!templateInfo) throw new Error(`Шаблон "${templateName}" не настроен.`);

        const prompt = `
            Твоя главная задача: Сгенерировать список вопросов для пользователя.
            **КРИТИЧЕСКОЕ ПРАВИЛО:** Язык для ВСЕХ генерируемых вопросов **ДОЛЖЕН БЫТЬ СТРОГО "${templateInfo.language}"**.
            
            **ПРАВИЛО ГРУППИРОВКИ:** Если в 'Списке тегов' ты видишь теги, начинающиеся с "doc_" (например, "doc_name"), ты ОБЯЗАН сгруппировать их все в ОДИН ОБЩИЙ вопрос. Этот вопрос должен быть привязан к тегу "documents" и просить пользователя перечислить все документы и их атрибуты. НЕ ДЕЛИ этот вопрос на части для каждого "doc_" тега.
    
            Твоя цель - помочь пользователю заполнить шаблон. Проанализируй PDF и для каждого тега из 'Списка тегов' (с учетом правила группировки) сформулируй вежливый и понятный вопрос.
            
            Верни ответ **СТРОГО и ТОЛЬКО в виде JSON-массива** объектов, где каждый объект имеет два поля: "tag" и "question". Без вводных слов.
    
            Список тегов, которые ты должен учесть:
            ${templateInfo.tags_in_template.map(tag => `- ${tag}`).join('\n')}
        `;

        const pdfPreviewPath = path.join(process.cwd(), 'knowledge_base', 'templates', 'pdf_previews', normalizedTemplateName.replace('.docx', '.pdf'));
        if (!fs.existsSync(pdfPreviewPath)) throw new Error(`PDF-превью для шаблона "${normalizedTemplateName}" не найдено.`);

        const pdfBuffer = fs.readFileSync(pdfPreviewPath);
        const base64Pdf = pdfBuffer.toString('base64');

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const result = await this.generateWithRetry([{ text: prompt }, { inlineData: { mimeType: 'application/pdf', data: base64Pdf } }]);
                const jsonMatch = result.match(/\[[\s\S]*\]/);
                if (jsonMatch && jsonMatch[0]) return JSON.parse(jsonMatch[0]);
                throw new Error('Valid JSON array not found in AI response.');
            } catch (error) {
                console.error(`[AI Service] Попытка ${attempt} не удалась при анализе шаблона ${templateName}. Ошибка:`, error.message);
                if (attempt === 3) throw new Error('Не удалось сгенерировать вопросы для документа.');
            }
        }
        throw new Error('Не удалось сгенерировать вопросы после всех попыток.');
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

    async extractDataForDocx(
        userAnswersPrompt: string,
        templateName: string,
        userId: number,
        currentQuestion?: string,
        currentTag?: string,
    ): Promise<{ data?: any; isComplete?: boolean; missingFields?: string[]; intent?: string; error?: string }> {
        const normalizedTemplateName = templateName.toLowerCase();
        const templateInfo = TEMPLATES_REGISTRY[normalizedTemplateName];
        if (!templateInfo) {
            throw new Error(`Шаблон "${templateName}" не найден.`);
        }

        const requiredTags = currentTag ? [currentTag] : templateInfo.tags_in_template;
        const history = await this.chatHistoryService.getHistory(userId, ChatType.DOCUMENT);
        const historyText = history.map(h => `${h.role === 'user' ? 'Пользователь' : 'Ассистент'}: ${h.parts[0].text}`).join('\n');
        const language = this.detectLanguage(userAnswersPrompt);

        const validationErrorResponse = language === 'kz'
            ? "Кешіріңіз, сіздің жауабыңыз сұраққа сәйкес келмейтін сияқты. Қайталап көріңізші."
            : "Извините, ваш ответ не похож на релевантную информацию. Пожалуйста, попробуйте еще раз.";

        const prompt = `
            Твоя роль - сверхточный робот-аналитик и валидатор JSON. Твоя работа критически важна.
    
            **ПЛАН ДЕЙСТВИЙ:**
            1.  **АНАЛИЗ НАМЕРЕНИЯ в ПОСЛЕДНЕМ СООБЩЕНИИ:**
                -   Если ПОСЛЕДНЕЕ сообщение — это отмена ("отмена", "не хочу"), ВЕРНИ ТОЛЬКО: \`{"intent": "cancel"}\`.
                -   Если ПОСЛЕДНЕЕ сообщение — это вопрос не по теме, ВЕРНИ ТОЛЬКО: \`{"intent": "query"}\`.
                -   ИНАЧЕ, переходи к шагу 2.
    
            2.  **ВАЛИДАЦИЯ И ИЗВЛЕЧЕНИЕ ДАННЫХ:**
                -   **ЕСЛИ тебе дан "Конкретный вопрос"**:
                    1.  Проанализируй "Последнее сообщение пользователя". Является ли оно релевантным ответом на вопрос?
                    2.  **ЕСЛИ ДА**, извлеки данные ТОЛЬКО для тега "${currentTag}". Верни JSON вида \`{"data": {"${currentTag}": "извлеченное значение"}}\`. Используй "Усиленный пример для списков", если тег - 'documents'.
                    3.  **ЕСЛИ НЕТ** (ответ нерелевантный, бред), ВЕРНИ ТОЛЬКО JSON: \`{"error": "${validationErrorResponse}"}\`.
                -   **ЕСЛИ "Конкретного вопроса" нет**:
                    1.  Проанализируй ВЕСЬ "Диалог для анализа".
                    2.  Собери информацию для ВСЕХ тегов из "Списка тегов".
                    3.  Верни полный JSON с полями "isComplete", "missingFields" и "data".
    
            **--- УСИЛЕННЫЙ ПРИМЕР ДЛЯ СПИСКОВ (используй, если currentTag - 'documents') ---**
            ПРИМЕР ВОПРОСА: "Пожалуйста, перечислите все передаваемые документы."
            ПРИМЕР ОТВЕТА: "Технический паспорт здания (12 листов), Проектная документация (45 листов)"
            ПРАВИЛЬНЫЙ РЕЗУЛЬТАТ для этого примера:
            {
                "data": {
                    "documents": [
                        { "doc_name": "Технический паспорт здания", "doc_sheet_count": "12" },
                        { "doc_name": "Проектная документация", "doc_sheet_count": "45" }
                    ]
                }
            }
            **--- КОНЕЦ ПРИМЕРА ---**
    
            ${currentQuestion ? `**Конкретный вопрос:** "${currentQuestion}"` : ''}
            
            **Список требуемых тегов:** 
            ${JSON.stringify(requiredTags)}
            
            **Диалог для анализа:**
            ---
            ${historyText}
            **Последнее сообщение пользователя:** ${userAnswersPrompt}
            ---
            
            Верни ответ СТРОГО в формате JSON.
            `;

        try {
            const rawResponse = await this.generateWithRetry(prompt);
            const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                console.error("AI не вернул валидный JSON. Ответ:", rawResponse);
                return { error: "Внутренняя ошибка обработки ответа." };
            }

            return JSON.parse(jsonMatch[0]);

        } catch (error) {
            console.error('Критическая ошибка при извлечении данных:', error);
            return { error: "Критическая ошибка при обработке вашего запроса." };
        }
    }

    async getGeneratedDocument(fileId: string, userId: number): Promise<GeneratedDocument | null> {
        return this.generatedDocRepo.findOne({
            where: {
                id: fileId,
                user: { id: userId } // Проверяем, что документ принадлежит именно этому пользователю
            }
        });
    }
}