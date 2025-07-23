// src/documents/docx/docx.service.ts

import { Injectable } from '@nestjs/common';
import * as PizZip from 'pizzip';
import * as Docxtemplater from 'docxtemplater';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class DocxService {
    generateDocx(templateName: string, data: any): Buffer {
        try {
            const templatePath = path.join(
                process.cwd(),
                'knowledge_base',
                'templates',
                'docx',
                templateName,
            );

            const content = fs.readFileSync(templatePath, 'binary');
            const zip = new PizZip(content);

            // УДАЛЯЕМ СТАРЫЙ nullGetter И ИНИЦИАЛИЗИРУЕМ DOCXTEMPLATER ВОТ ТАК:
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true, // Эта опция как раз отвечает за циклы в таблицах
                linebreaks: true,
                // Мы убрали отсюда кастомный nullGetter. Теперь библиотека будет
                // корректно работать с вложенными данными в циклах.
            });

            // Этот метод теперь будет работать правильно с таблицами
            doc.render(data);

            const buf = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });

            return buf;
        } catch (error) {
            // Если в данных не хватает какого-то тега, ошибка возникнет здесь.
            // Это хорошо для отладки, так как сразу видно, что AI не извлек все данные.
            console.error('Ошибка при генерации DOCX:', error);
            throw new Error(`Не удалось сгенерировать документ из шаблона ${templateName}. Проверьте, что все данные были предоставлены. Ошибка: ${error.message}`);
        }
    }
}