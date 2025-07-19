const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');

const knowledgeBaseDir = path.join(__dirname, 'knowledge_base');
const cacheDir = path.join(__dirname, '.pdf-cache');

async function createCache() {
  console.log('--- НАЧИНАЮ КЭШИРОВАНИЕ БАЗЫ ЗНАНИЙ ---');
  
  if (!fs.existsSync(cacheDir)) {
    console.log('Создаю папку для кэша: .pdf-cache');
    fs.mkdirSync(cacheDir);
  }

  const fileNames = fs.readdirSync(knowledgeBaseDir);
  const pdfFiles = fileNames.filter(file => file.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) {
    console.log('Не найдено PDF-файлов в папке knowledge_base.');
    return;
  }

  console.log(`Найдено ${pdfFiles.length} PDF-файлов. Начинаю обработку...`);

  for (const fileName of pdfFiles) {
    try {
      const filePath = path.join(knowledgeBaseDir, fileName);
      const cachePath = path.join(cacheDir, `${fileName}.txt`);
      
      console.log(`- Обрабатываю: ${fileName}...`);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdf(dataBuffer);
      
      fs.writeFileSync(cachePath, data.text);
      console.log(`  ...УСПЕХ! Текст сохранен в .pdf-cache/${fileName}.txt`);

    } catch (error) {
      console.error(`  ...ПРОВАЛ! Ошибка при обработке файла ${fileName}:`, error.message);
    }
  }

  console.log('\n--- КЭШИРОВАНИЕ ЗАВЕРШЕНО ---');
}

createCache();
