const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

// Директории, в которых нужно искать PDF для базы знаний
const inputDirs = [
  path.join(__dirname, '..', 'knowledge_base'), // Добавлено '..' для корректного пути из /dist
  path.join(__dirname, '..', 'knowledge_base/templates/pdf_previews'),
];
// Папка для сохранения текстовых кэш-файлов
const cacheDir = path.join(__dirname, '..', '.pdf-cache');

/**
 * Асинхронная функция для создания текстового кэша из PDF-файлов.
 */
async function createCache() {
  console.log('--- НАЧИНАЮ КЭШИРОВАНИЕ БАЗЫ ЗНАНИЙ ---');
  if (!fs.existsSync(cacheDir)) {
    console.log('Создаю папку для кэша: .pdf-cache');
    fs.mkdirSync(cacheDir);
  }

  for (const dir of inputDirs) {
    if (!fs.existsSync(dir)) {
      console.log(`Пропускаю: Папка не найдена -> ${dir}`);
      continue;
    }

    const fileNames = fs.readdirSync(dir);
    const pdfFiles = fileNames.filter(file => file.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.log(`Нет PDF-файлов в папке ${dir}`);
      continue;
    }
    console.log(`\nПапка: ${dir}`);
    console.log(`Найдено ${pdfFiles.length} PDF-файлов. Начинаю обработку...`);

    for (const fileName of pdfFiles) {
      try {
        const filePath = path.join(dir, fileName);
        const cachePath = path.join(cacheDir, `${fileName}.txt`);
        console.log(`- Обрабатываю: ${fileName}...`);
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdf(dataBuffer); // Парсим PDF
        fs.writeFileSync(cachePath, data.text); // Сохраняем текст в кэш
        console.log(`  ...УСПЕХ! Текст сохранен в .pdf-cache/${fileName}.txt`);
      } catch (error) {
        console.error(`  ...ПРОВАЛ! Ошибка при обработке файла ${fileName}:`, error.message);
      }
    }
  }
  console.log('\n--- КЭШИРОВАНИЕ ЗАВЕРШЕНО ---');
}

// Запускаем кэширование сразу после объявления
createCache();