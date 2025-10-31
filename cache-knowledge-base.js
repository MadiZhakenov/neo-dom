// Файл: cache-knowledge-base.js
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const basePath = __dirname; // Используем директорию, где лежит сам скрипт
console.log(`[Cache Script] Base path is: ${basePath}`);
const knowledgeBaseDir = path.join(basePath, 'knowledge_base');
// const knowledgeBaseDir = path.join(basePath, 'knowledge_base/templates/pdf_previews');
const cacheDir = path.join(basePath, '.pdf-cache');

async function createCache() {
    console.log('--- [Cache Script] STARTING KNOWLEDGE BASE CACHING ---');

    if (!fs.existsSync(knowledgeBaseDir)) {
        console.error(`[Cache Script] ERROR: knowledge_base directory not found at ${knowledgeBaseDir}!`);
        return;
    }

    if (!fs.existsSync(cacheDir)) {
        console.log(`[Cache Script] Creating cache directory: .pdf-cache`);
        fs.mkdirSync(cacheDir);
    }

    const allFiles = fs.readdirSync(knowledgeBaseDir);
    const pdfFiles = allFiles.filter(file => file.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
        console.warn(`[Cache Script] WARNING: No PDF files found in ${knowledgeBaseDir}.`);
        return;
    }

    console.log(`[Cache Script] Found ${pdfFiles.length} PDF files. Starting processing...`);
    let processedCount = 0;

    for (const fileName of pdfFiles) {
        try {
            const filePath = path.join(knowledgeBaseDir, fileName);
            const cachePath = path.join(cacheDir, `${fileName}.txt`);

            console.log(`- Processing: ${fileName}...`);
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdf(dataBuffer);
            // --- НАЧАЛО НОВОЙ, УЛУЧШЕННОЙ ЛОГИКИ ОЧИСТКИ ---

            // Шаг 1: Находим настоящие разрывы абзацев (2+ переноса строки)
            // и заменяем их временным плейсхолдером.
            let cleanedText = data.text.replace(/(\r\n|\n){2,}/g, '_PARAGRAPH_BREAK_');

            // Шаг 2: Теперь все оставшиеся переносы строки - это просто разрывы строк
            // внутри абзацев. Заменяем их на пробелы, чтобы склеить слова.
            cleanedText = cleanedText.replace(/(\r\n|\n)/g, ' ');

            // Шаг 3: Восстанавливаем наши сохраненные разрывы абзацев.
            cleanedText = cleanedText.replace(/_PARAGRAPH_BREAK_/g, '\n\n');

            // (Опционально) Шаг 4: Убираем лишние пробелы, которые могли образоваться.
            cleanedText = cleanedText.replace(/ +/g, ' ').trim();

            // --- КОНЕЦ НОВОЙ ЛОГИКИ ОЧИСТКИ ---
            fs.writeFileSync(cachePath, cleanedText);
            console.log(`  ...SUCCESS! Text saved to .pdf-cache/${fileName}.txt`);
            processedCount++;
        } catch (error) {
            console.error(`  ...FAILURE! Error processing file ${fileName}:`, error.message);
        }
    }

    console.log(`\n--- [Cache Script] CACHING FINISHED. Processed ${processedCount}/${pdfFiles.length} files. ---`);
}

createCache();