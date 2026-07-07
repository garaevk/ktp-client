/**
 * Парсер PDF файлов для извлечения календарного учебного графика
 */
class PdfParser {
    constructor() {
        this.pdfDoc = null;
    }

    /**
     * Загрузить и распарсить PDF файл
     * @param {File} file - Файл PDF
     * @returns {Promise<Object>} - Объект с календарными данными
     */
    async parse(file) {
        try {
            // Загрузить PDF
            const arrayBuffer = await file.arrayBuffer();
            this.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            // Извлечь текст со всех страниц
            const fullText = await this.extractAllText();
            
            // Распарсить календарные данные
            return this.parseCalendarData(fullText);
        } catch (error) {
            console.error('Ошибка парсинга PDF:', error);
            throw new Error('Не удалось прочитать файл PDF: ' + error.message);
        }
    }

    /**
     * Извлечь текст со всех страниц PDF
     * @returns {Promise<string>} - Полный текст
     */
    async extractAllText() {
        let fullText = '';
        
        for (let i = 1; i <= this.pdfDoc.numPages; i++) {
            const page = await this.pdfDoc.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        
        return fullText;
    }

    /**
     * Распарсить календарные данные из текста
     * @param {string} text - Текст из PDF
     * @returns {Object} - Календарные данные
     */
    parseCalendarData(text) {
        const result = {
            quarters: [],
            holidays: [],
            specialHolidays: []
        };

        // Ищем четверти (формат: "1 четверть: 01.09.2025 - 26.10.2025")
        const quarterPatterns = [
            /(\d+)\s*четверть[:\s]+(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/gi,
            /(\d+)\s*полугодие[:\s]+(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/gi
        ];

        for (const pattern of quarterPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                result.quarters.push({
                    name: `${match[1]} четверть`,
                    start: this.parseDate(match[2]),
                    end: this.parseDate(match[3])
                });
            }
        }

        // Ищем каникулы (формат: "Осенние каникулы: 27.10.2025 - 05.11.2025")
        const holidayPattern = /([А-Яа-я\s]+)\s*каникулы[:\s]+(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*(\d{2}\.\d{2}\.\d{4})/gi;
        let match;
        while ((match = holidayPattern.exec(text)) !== null) {
            result.holidays.push({
                name: match[1].trim() + ' каникулы',
                start: this.parseDate(match[2]),
                end: this.parseDate(match[3])
            });
        }

        // Ищем праздничные дни (формат: "01.01.2026 - Новый год")
        const specialHolidayPattern = /(\d{2}\.\d{2}\.\d{4})\s*[-–]\s*([А-Яа-я\s]+)/gi;
        while ((match = specialHolidayPattern.exec(text)) !== null) {
            const date = this.parseDate(match[1]);
            const name = match[2].trim();
            
            // Проверяем, что это не четверть и не каникулы
            if (!result.quarters.some(q => q.start === date || q.end === date) &&
                !result.holidays.some(h => h.start === date || h.end === date)) {
                result.specialHolidays.push({
                    date: date,
                    name: name
                });
            }
        }

        return result;
    }

    /**
     * Распарсить дату из строки
     * @param {string} dateStr - Строка даты (ДД.ММ.ГГГГ)
     * @returns {Date} - Объект Date
     */
    parseDate(dateStr) {
        const parts = dateStr.split('.');
        if (parts.length !== 3) {
            return null;
        }
        
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Месяцы в JS начинаются с 0
        const year = parseInt(parts[2]);
        
        return new Date(year, month, day);
    }

    /**
     * Форматировать дату в строку
     * @param {Date} date - Объект Date
     * @returns {string} - Строка даты (ДД.ММ.ГГГГ)
     */
    formatDate(date) {
        if (!date) return '';
        
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        
        return `${day}.${month}.${year}`;
    }
}
