import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as fs from 'fs';
import * as path from 'path';

import { Document } from 'langchain/document';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';

import { ChatHistoryService } from '../chat/history/history.service';
import { ChatType } from '../chat/entities/chat-message.entity';

@Injectable()
export class ChatAiService implements OnModuleInit {
    private readonly logger = new Logger(ChatAiService.name);
    private model: any;
    private vectorStore: HNSWLib | null = null;
    private embeddings: GoogleGenerativeAIEmbeddings;
    
    private readonly TEXT_CACHE_DIR = path.join(process.cwd(), '.pdf-cache');
    private readonly INDEX_DIR = path.join(process.cwd(), '.rag-index');
    private readonly MAX_SEARCH_RESULTS = 3;

    private readonly SYSTEM_PROMPT = `
    Ты — NeoDom AI, высококвалифицированный цифровой ассистент и эксперт по всем вопросам, связанным с жизнью и управлением в многоквартирных домах (ОСИ/ЖКХ) в Казахстане.

    **ТВОЯ ГЛАВНАЯ ЗАДАЧА:** Давать пользователям максимально полезные, пошаговые и практически применимые советы.

    **ПРАВИЛА ПОВЕДЕНИЯ:**

    1.  **ДВУХУРОВНЕВЫЙ ОТВЕТ:**
        *   **ПЛАН А (Ответ по документам):** Если КОНТЕКСТ НЕ ПУСТОЙ, твой ответ ДОЛЖЕН быть на 100% основан на этом контексте. Это твой главный приоритет. Обязательно ссылайся на источник, если он указан (например, "Согласно СТ РК 2864-2016...").
        *   **ПЛАН Б (Совет эксперта):** Если КОНТЕКСТ ПУСТОЙ или не содержит ответа, ты ОБЯЗАН дать развернутый и полезный совет, основываясь на общих знаниях законодательства и жизненной практики в Казахстане.

    2.  **ШИРОКАЯ КОМПЕТЕНЦИЯ:** Твоя экспертиза включает, но не ограничивается:
        *   **Технические вопросы:** Ремонт, эксплуатация, стандарты.
        *   **Юридические вопросы:** Споры с соседями (шум, затопление), правила перепланировки, ответственность.
        *   **Административные вопросы:** Проведение собраний, создание ОСИ, взаимодействие с управляющими компаниями.
        *   **Финансовые вопросы:** Взносы, тарифы, аудит.

    3.  **ОГРАНИЧЕНИЕ:** Если вопрос СОВСЕМ не касается жизни в доме (например, о погоде, политике, кулинарии), вежливо, но кратко объясни свою специализацию и откажись от ответа. Пример: "Моя специализация — вопросы жилищно-коммунального хозяйства в Казахстане. Я не могу предоставить информацию на эту тему."

    4.  **СТРОГИЕ ТРЕБОВАНИЯ:**
        *   **ЯЗЫК:** Отвечай СТРОГО на языке вопроса.
        *   **СТРУКТУРА:** Сложные ответы всегда разбивай на нумерованные списки или пошаговые инструкции (Шаг 1, Шаг 2...).
        *    **ТОН ОБЩЕНИЯ:**
            *   **На экспертные вопросы:** Отвечай сразу по делу. Не начинай ответ на технический, юридический или административный вопрос с приветствий.
            *   **На неформальное общение:** Если пользователь просто здоровается (например, "Привет", "Добрый день") или прощается ("Пока"), отвечай кратко и симметрично (например, "Привет!", "Всего доброго."). Не добавляй свою экспертную информацию к таким коротким ответам.

    ---
    КОНТЕКСТ ИЗ ДОКУМЕНТОВ:
    {context}
    ---

    ВОПРОС ПОЛЬЗОВАТЕЛЯ:
    {question}
    ---

    ОТВЕТ ЭКСПЕРТА:
    `.trim();

    constructor(
        private readonly configService: ConfigService,
        private readonly chatHistoryService: ChatHistoryService,
    ) { }

    async onModuleInit() {
        const apiKey = this.configService.get<string>('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GEMINI_API_KEY отсутствует в .env');

        const genAI = new GoogleGenerativeAI(apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

        this.embeddings = new GoogleGenerativeAIEmbeddings({
            apiKey,
            modelName: 'embedding-001',
        });

        await this.initializeVectorStore();
    }

    private async initializeVectorStore() {
        if (!fs.existsSync(this.TEXT_CACHE_DIR)) {
            throw new Error(`Директория .pdf-cache не найдена: ${this.TEXT_CACHE_DIR}`);
        }

        const indexMetaPath = path.join(this.INDEX_DIR, 'hnswlib.index');
        if (fs.existsSync(indexMetaPath)) {
            try {
                this.logger.log('Загрузка векторного индекса...');
                this.vectorStore = await HNSWLib.load(this.INDEX_DIR, this.embeddings);
                return;
            } catch (error) {
                this.logger.warn('Ошибка загрузки индекса, пересобираем...', error);
            }
        }

        this.logger.log('Создание векторного индекса...');
        
        const fileNames = fs.readdirSync(this.TEXT_CACHE_DIR).filter(f => f.endsWith('.txt'));
        if (fileNames.length === 0) {
            throw new Error('Нет текстовых файлов в .pdf-cache');
        }

        const rawDocs: Document[] = fileNames.map(fileName => ({
            pageContent: fs.readFileSync(path.join(this.TEXT_CACHE_DIR, fileName), 'utf-8'),
            metadata: { source: fileName },
        }));

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1200,
            chunkOverlap: 200,
        });

        const chunkedDocs: Document[] = [];
        for (const doc of rawDocs) {
            const parts = await splitter.splitDocuments([doc]);
            chunkedDocs.push(...parts);
        }

        this.vectorStore = await HNSWLib.fromDocuments(chunkedDocs, this.embeddings);
        await this.vectorStore.save(this.INDEX_DIR);
        this.logger.log(`Векторный индекс создан: ${chunkedDocs.length} чанков`);
    }

    async getChatAnswer(prompt: string, userId: number): Promise<string> {
        const startTime = Date.now();
        
        try {
            const relevantDocs = await this.getRelevantDocs(prompt);
            const context = this.buildContext(relevantDocs);
            const answer = await this.generateAnswer(prompt, context);
            
            await this.chatHistoryService.addMessageToHistory(
                userId, 
                prompt, 
                answer, 
                ChatType.GENERAL
            );
            
            const endTime = Date.now();
            this.logger.log(`Ответ за ${endTime - startTime}ms`);
            
            return answer;
        } catch (error) {
            this.logger.error('Ошибка:', error);
            return 'Извините, произошла ошибка. Попробуйте еще раз.';
        }
    }

    private async getRelevantDocs(question: string): Promise<Document[]> {
        if (!this.vectorStore) return [];
        return await this.vectorStore.similaritySearch(question, this.MAX_SEARCH_RESULTS);
    }

    private buildContext(docs: Document[]): string {
        if (docs.length === 0) return '';
        return docs.map(doc => `[${doc.metadata.source}]: ${doc.pageContent}`).join('\n\n');
    }

    private async generateAnswer(question: string, context: string): Promise<string> {
        const finalPrompt = this.SYSTEM_PROMPT
            .replace('{context}', context)
            .replace('{question}', question);

        const chat = this.model.startChat({ 
            history: [],
            generationConfig: {
                temperature: 0.9,
            }
        });
        
        const result = await chat.sendMessage(finalPrompt);
        return result.response.text().replace(/[*#_`~]/g, '').trim();
    }

    async rebuildIndex(): Promise<void> {
        if (fs.existsSync(this.INDEX_DIR)) {
            fs.rmSync(this.INDEX_DIR, { recursive: true, force: true });
        }
        await this.initializeVectorStore();
    }
}