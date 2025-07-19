// upload-knowledge-base.js

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("ОШИБКА: API-ключ не найден в файле .env.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

const knowledgeBaseDir = path.join(__dirname, 'knowledge_base');

async function uploadToGemini(filePath) {
    const fileName = path.basename(filePath);
    console.log(`- Обрабатываю файл: ${fileName}...`);
    try {
        // Чтение файла и преобразование в base64
        const fileData = fs.readFileSync(filePath);
        const base64Data = fileData.toString('base64');
        
        // Создание объекта файла для Gemini
        const file = {
            inlineData: {
                data: base64Data,
                mimeType: 'application/pdf'
            }
        };
        
        console.log(`  ...Файл подготовлен для использования с Gemini`);
        return file;
    } catch (error) {
        console.error(`  ...ОШИБКА! Не удалось обработать файл ${fileName}:`, error);
        return null;
    }
}

async function main() {
    console.log('--- НАЧИНАЮ ОБРАБОТКУ ФАЙЛОВ ИЗ БАЗЫ ЗНАНИЙ ---');
    const fileNames = fs.readdirSync(knowledgeBaseDir);
    const pdfFiles = fileNames.filter(file => file.toLowerCase().endsWith('.pdf'));

    console.log(`Найдено ${pdfFiles.length} PDF-файлов для обработки.`);

    const processedFiles = [];
    for (const fileName of pdfFiles) {
        const fullPath = path.join(knowledgeBaseDir, fileName);
        const processedFile = await uploadToGemini(fullPath);
        if (processedFile) {
            processedFiles.push({
                fileName: fileName,
                fileObject: processedFile
            });
        }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }

    console.log('\n--- ОБРАБОТКА ЗАВЕРШЕНА ---');
    console.log(`Успешно обработано: ${processedFiles.length} из ${pdfFiles.length} файлов.`);

    if (processedFiles.length > 0) {
        console.log('\n--- РЕЗУЛЬТАТ: СОХРАНИТЕ ЭТИ ДАННЫЕ! ---');
        const fileDataForCode = processedFiles.map(item => ({
            originalName: item.fileName,
            mimeType: item.fileObject.inlineData.mimeType,
            size: Buffer.from(item.fileObject.inlineData.data, 'base64').length
        }));
        console.log(JSON.stringify(fileDataForCode, null, 2));
        
        // Пример использования с моделью Gemini
        console.log('\n--- ПРИМЕР ИСПОЛЬЗОВАНИЯ С МОДЕЛЬЮ ---');
        const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });
        // Здесь вы можете использовать processedFiles[0].fileObject с моделью
    }
}

main();