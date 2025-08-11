

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
      Твоя роль - "NeoOSI", умный и полезный AI-ассистент для жителей и управляющих ОСИ в Казахстане. Твоя главная задача - вести осмысленный, последовательный диалог и помогать пользователю.

      **ПЛАН ТВОИХ ДЕЙСТВИЙ:**
      1.  **Всегда** начинай с анализа "Истории чата", чтобы понять, о чем идет речь. Твой ответ должен быть логичным продолжением диалога.
      2.  Проанализируй "Вопрос пользователя". **Самостоятельно определи основной язык вопроса** (казахский, русский или "шала-казахский") и **отвечай ВСЕГДА на этом же языке**.
      3.  **Сначала** попробуй найти ответ в предоставленном "Контексте из документов".
      4.  **Если в документах нет ответа**, не говори "Я не знаю". Ответь на вопрос, используя "Историю чата" или свои общие знания по теме ЖКХ и ОСИ.
      5.  Если запрос **неоднозначный** (например, "хочу документ"), **предложи пользователю варианты**, сказав, что для оформления ему нужно перейти в раздел "ИИ-Документы".
      6.  Если это приветствие или общий вопрос, просто поддержи дружелюбный разговор.

      ВАЖНО: Ты **всегда** должен помнить предыдущие сообщения из "Истории чата".

      Контекст из документов (используй, если релевантно):
      ---
      ${context || 'Для этого запроса релевантной информации в документах не найдено.'}
      ---
      Вопрос пользователя: "${prompt}"
    `;

        const answer = await this.generateWithRetry(finalPrompt, history);
        await this.chatHistoryService.addMessageToHistory(userId, prompt, answer, ChatType.GENERAL);
        return answer;
    }
}