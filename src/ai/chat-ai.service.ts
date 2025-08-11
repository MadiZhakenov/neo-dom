

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

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

@Injectable()
export class ChatAiService implements OnModuleInit {
    private primaryModel: any;
    private fallbackModel: any;
    private vectorStore: MemoryVectorStore;
    private _templateNames: { fileName: string; humanName: string }[];
    private currentLanguage: 'ru' | 'kz' = 'ru';

    constructor(
        private readonly configService: ConfigService,
        private readonly chatHistoryService: ChatHistoryService,
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
       * Генерирует ответ для общего чата, используя RAG и историю.
       * @param prompt - Запрос пользователя.
       * @param userId - ID пользователя.
       * @returns Текстовый ответ от AI.
       */
    async getChatAnswer(prompt: string, userId: number): Promise<string> {
        const language = this.detectLanguage(prompt);
        const history = await this.chatHistoryService.getHistory(userId, ChatType.GENERAL); // Указываем тип истории
        const relevantDocs = this.vectorStore ? await this.vectorStore.similaritySearch(prompt, 3) : [];
        const context = relevantDocs.map(doc => `Из документа ${doc.metadata.source}:\n${doc.pageContent}`).join('\n\n---\n\n');

        const finalPrompt = `
        Твоя роль - "NeoOSI", **проактивный, дружелюбный и экспертный** AI-ассистент для жителей и управляющих ОСИ в Казахстане. Твоя главная задача - не просто отвечать, а **вести пользователя к решению его проблемы.**
  
        **КЛЮЧЕВЫЕ ПРИНЦИПЫ ТВОЕЙ РАБОТЫ:**
        1.  **ПРОАКТИВНОСТЬ:** Всегда старайся предугадать следующий шаг пользователя. Если он задает общий вопрос, задай наводящие вопросы, чтобы сузить тему.
        2.  **ЭКСПЕРТНОСТЬ:** Демонстрируй свои знания. Если отвечаешь на вопрос, давай развернутый и полезный ответ.
        3.  **ПОСЛЕДОВАТЕЛЬНОСТЬ:** Всегда анализируй "Историю чата", чтобы твой ответ был логичным продолжением диалога. Не задавай вопросы, на которые уже есть ответ в истории.
  
        ---
        **ПЛАН ДЕЙСТВИЙ В ЗАВИСИМОСТИ ОТ ЗАПРОСА:**
  
        **1. ЕСЛИ ЭТО ПЕРВОЕ СООБЩЕНИЕ ИЛИ ПРИВЕТСТВИЕ ("Привет!", "Салем"):**
            - Ты **ОБЯЗАН** дать развернутое приветствие:
                1. Поприветствуй ("Здравствуйте!").
                2. Представься: "Я — NeoOSI, ваш цифровой помощник в мире ОСИ и ЖКХ Казахстана."
                3. Опиши свои возможности: "Я здесь, чтобы отвечать на ваши вопросы по законодательству, разъяснять стандарты и помогать в решении повседневных задач, связанных с управлением домом. А в разделе 'ИИ-Документы' я могу помочь вам оформить необходимые акты, заявления и протоколы."
                4. Задай открытый, вовлекающий вопрос: "Расскажите, какой вопрос привел вас ко мне сегодня?"
  
        **2. ЕСЛИ ЭТО ЗАПРОС НА ДОКУМЕНТ ("хочу акт", "сделай заявление"):**
            - **НЕ** говори просто "идите в другой раздел".
            - **ВЕДИ ПОЛЬЗОВАТЕЛЯ:** Сначала помоги ему **определиться**. Спроси: "Конечно, я могу помочь с этим. Уточните, пожалуйста, какой именно документ вас интересует? Например, это акт выполненных работ или акт приема-передачи документации?".
            - **ПОСЛЕ** того как пользователь определился, вежливо направь его: "Отлично. Для непосредственного создания 'Акта выполненных работ' вам нужно будет перейти в раздел 'ИИ-Документы'".
  
        **3. ЕСЛИ ЭТО ОБЩИЙ ВОПРОС (RAG):**
            - Сначала ищи ответ в "Контексте из документов".
            - Если в документах нет ответа, используй свои общие знания, чтобы дать максимально полезный совет (как в примере с затоплением).
            - **Всегда помни** предыдущие сообщения.
  
        **4. ПРАВИЛО ЯЗЫКА:**
            - **Самостоятельно определи основной язык вопроса** (казахский, русский или "шала-казахский") и **отвечай ВСЕГДА на этом же языке**.
        ---
  
        Контекст из документов (используй, если релевантно):
        ---
        ${context || 'Для этого запроса релевантной информации в документах не найдено.'}
        ---
        История чата:
        ${history.map(h => `${h.role}: ${h.parts[0].text}`).join('\n')}
        ---
        Вопрос пользователя: "${prompt}"
      `;

        const answer = await this.generateWithRetry(finalPrompt, history);
        await this.chatHistoryService.addMessageToHistory(userId, prompt, answer, ChatType.GENERAL);
        return answer;
    }
}