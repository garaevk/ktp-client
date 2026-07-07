/**
 * Парсер .docx файлов для извлечения таблиц
 */
class DocxParser {
    constructor() {
        this.zip = null;
        this.documentXml = null;
    }

    /**
     * Загрузить и распарсить .docx файл
     * @param {File} file - Файл .docx
     * @returns {Promise<Array>} - Массив таблиц
     */
    async parse(file) {
        try {
            // Распаковать .docx (это ZIP-архив)
            this.zip = await JSZip.loadAsync(file);
            
            // Извлечь document.xml
            const documentXmlFile = this.zip.file('word/document.xml');
            if (!documentXmlFile) {
                throw new Error('Не найден файл document.xml в .docx');
            }
            
            const xmlContent = await documentXmlFile.async('string');
            this.documentXml = new DOMParser().parseFromString(xmlContent, 'text/xml');
            
            // Извлечь таблицы
            return this.extractTables();
        } catch (error) {
            console.error('Ошибка парсинга .docx:', error);
            throw new Error('Не удалось прочитать файл .docx: ' + error.message);
        }
    }

    /**
     * Извлечь все таблицы из документа
     * @returns {Array} - Массив таблиц
     */
    extractTables() {
        const tables = [];
        // Используем getElementsByTagName с локальным именем
        const tableElements = this.documentXml.getElementsByTagName('w:tbl');
        
        for (let i = 0; i < tableElements.length; i++) {
            const table = this.parseTable(tableElements[i], i);
            if (table) {
                tables.push(table);
            }
        }
        
        return tables;
    }

    /**
     * Распарсить одну таблицу
     * @param {Element} tableElement - XML элемент таблицы
     * @param {number} index - Индекс таблицы
     * @returns {Object} - Объект таблицы
     */
    parseTable(tableElement, index) {
        const rows = [];
        const rowElements = tableElement.getElementsByTagName('w:tr');
        
        for (let i = 0; i < rowElements.length; i++) {
            const row = this.parseRow(rowElements[i]);
            if (row) {
                rows.push(row);
            }
        }
        
        if (rows.length === 0) {
            return null;
        }

        // Определить заголовки (первая строка)
        const headers = rows[0] || [];
        
        // Определить количество колонок
        const cols = headers.length;
        
        // Создать описание таблицы
        const description = this.describeTable(headers, rows);
        
        return {
            index: index,
            rows: rows,
            headers: headers,
            cols: cols,
            rowCount: rows.length,
            description: description
        };
    }

    /**
     * Распарсить одну строку таблицы
     * @param {Element} rowElement - XML элемент строки
     * @returns {Array} - Массив ячеек
     */
    parseRow(rowElement) {
        const cells = [];
        const cellElements = rowElement.getElementsByTagName('w:tc');
        
        for (let i = 0; i < cellElements.length; i++) {
            const cellText = this.extractCellText(cellElements[i]);
            cells.push(cellText);
        }
        
        return cells;
    }

    /**
     * Извлечь текст из ячейки
     * @param {Element} cellElement - XML элемент ячейки
     * @returns {string} - Текст ячейки
     */
    extractCellText(cellElement) {
        const textParts = [];
        const textElements = cellElement.getElementsByTagName('w:t');
        
        for (let i = 0; i < textElements.length; i++) {
            const text = textElements[i].textContent;
            if (text) {
                textParts.push(text);
            }
        }
        
        return textParts.join(' ').trim();
    }

    /**
     * Создать описание таблицы для отображения
     * @param {Array} headers - Заголовки
     * @param {Array} rows - Строки
     * @returns {string} - Описание
     */
    describeTable(headers, rows) {
        const preview = headers.slice(0, 5).join(' | ');
        return `Таблица: ${preview}${headers.length > 5 ? '...' : ''}`;
    }

    /**
     * Определить таблицу с уроками (автоматический выбор)
     * @param {Array} tables - Массив таблиц
     * @returns {number} - Индекс таблицы с уроками
     */
    findLessonsTable(tables) {
        // Ищем таблицу с заголовками, содержащими ключевые слова
        const keywords = ['тема', 'урок', 'занятие', 'дата', 'час'];
        
        for (let i = 0; i < tables.length; i++) {
            const table = tables[i];
            const headersText = table.headers.join(' ').toLowerCase();
            
            // Проверяем наличие ключевых слов
            const hasKeywords = keywords.some(keyword => headersText.includes(keyword));
            
            // Проверяем количество строк (должно быть много)
            const hasManyRows = table.rowCount > 10;
            
            if (hasKeywords || hasManyRows) {
                return i;
            }
        }
        
        // Если не нашли, возвращаем первую таблицу
        return 0;
    }

    /**
     * Извлечь уроки из выбранной таблицы
     * @param {Object} table - Объект таблицы
     * @returns {Array} - Массив уроков
     */
    extractLessons(table) {
        const lessons = [];
        
        // Пропускаем первые 2 строки (заголовки)
        for (let i = 2; i < table.rows.length; i++) {
            const row = table.rows[i];
            
            if (row.length < 3) {
                continue;
            }
            
            // Структура: № | Тема | Часы | Контрольные | Практические | Дата | Ресурсы
            const num = row[0] || '';
            const theme = row[1] || '';
            const hours = row[2] || '';
            const control = row[3] || '';
            const practical = row[4] || '';
            const resources = row[6] || '';
            
            // Пропускаем пустые строки
            if (!theme && !hours) {
                continue;
            }
            
            // Если номер не число, используем индекс строки
            const lessonNum = num.trim().match(/^\d+$/) ? num : String(lessons.length + 1);
            
            lessons.push({
                num: lessonNum,
                theme: theme,
                hours: hours,
                control: control,
                practical: practical,
                resources: resources,
                date: '' // Будет заполнено позже
            });
        }
        
        return lessons;
    }
}
