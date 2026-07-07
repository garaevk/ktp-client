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
            /(\d+)\s*четверть[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi,
            /(\d+)\s*полугодие[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi,
            /I{1,3}\s+четверть[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi,
            /I{1,2}\s+полугодие[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi
        ];

        for (const pattern of quarterPatterns) {
            let match;
            while ((match = pattern.exec(text)) !== null) {
                if (match[1] && match[2] && match[3]) {
                    result.quarters.push({
                        name: `${match[1]} четверть`,
                        start: this.parseDate(match[2]),
                        end: this.parseDate(match[3])
                    });
                } else if (match[1] && match[2]) {
                    // For Roman numeral patterns
                    const name = match[0].split(/[:\s]+/)[0].trim();
                    result.quarters.push({
                        name: name,
                        start: this.parseDate(match[1]),
                        end: this.parseDate(match[2])
                    });
                }
            }
        }

        // Ищем каникулы и выходные/праздничные дни по ключевым словам
        const datePattern = /(\d{1,2})[. ](\d{1,2})[. ](\d{4})/g;
        const keywords = ['каникул', 'выходн', 'праздн'];
        
        for (const kw of keywords) {
            const kwPattern = new RegExp(kw, 'gi');
            let kwMatch;
            while ((kwMatch = kwPattern.exec(text)) !== null) {
                // Ищем даты в окрестности ключевого слова (±150 символов)
                const start = Math.max(0, kwMatch.index - 50);
                const end = Math.min(text.length, kwMatch.index + 150);
                const context = text.substring(start, end);
                
                const datesFound = [];
                const dateRegex = /(\d{1,2})[. ](\d{1,2})[. ](\d{4})/g;
                let dateMatch;
                while ((dateMatch = dateRegex.exec(context)) !== null) {
                    const d = this.parseDate(`${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`);
                    if (d) datesFound.push(d);
                }
                
                if (datesFound.length >= 2) {
                    // Диапазон дат — это каникулы
                    const before = text.substring(Math.max(0, kwMatch.index - 50), kwMatch.index);
                    const nameMatch = before.match(/([А-Яа-яё\s]+)$/i);
                    const name = nameMatch ? nameMatch[1].trim() : kw;
                    
                    // Проверяем, что такой диапазон ещё не добавлен
                    const startStr = this.formatDate(datesFound[0]);
                    const endStr = this.formatDate(datesFound[1]);
                    const exists = result.holidays.some(h => 
                        this.formatDate(h.start) === startStr && this.formatDate(h.end) === endStr
                    );
                    
                    if (!exists) {
                        result.holidays.push({
                            name: name + (kw === 'каникул' ? ' каникулы' : ''),
                            start: datesFound[0],
                            end: datesFound[1]
                        });
                    }
                } else if (datesFound.length === 1) {
                    // Одна дата — это праздничный/выходной день
                    const dateStr = this.formatDate(datesFound[0]);
                    
                    // Проверяем, что эта дата ещё не добавлена
                    const exists = result.specialHolidays.some(sh => 
                        this.formatDate(sh.date) === dateStr
                    );
                    
                    if (!exists) {
                        // Ищем название после даты
                        const afterDate = context.substring(context.indexOf(dateStr.split('.').reverse().join('.')) + 10);
                        const nameMatch = afterDate.match(/[–-]\s*([А-Яа-яё\s]+)/i);
                        const name = nameMatch ? nameMatch[1].trim() : (kw === 'каникул' ? 'Каникулы' : 'Выходной');
                        
                        result.specialHolidays.push({
                            date: datesFound[0],
                            name: name
                        });
                    }
                }
            }
        }

        // Если каникулы не найдены по ключевым словам, пробуем старый паттерн
        if (result.holidays.length === 0) {
            const holidayPattern = /([А-Яа-яё\s]+)\s*каникулы[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–]\s*(\d{1,2}\.\d{1,2}\.\d{4})/gi;
            let match;
            while ((match = holidayPattern.exec(text)) !== null) {
                result.holidays.push({
                    name: match[1].trim() + ' каникулы',
                    start: this.parseDate(match[2]),
                    end: this.parseDate(match[3])
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
        if (!dateStr) return null;
        
        // Убираем лишние пробелы и нормализуем разделители
        const cleaned = dateStr.trim().replace(/\s+/g, '');
        const parts = cleaned.split(/[.\-\/]/);
        
        if (parts.length !== 3) {
            return null;
        }
        
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1; // Месяцы в JS начинаются с 0
        const year = parseInt(parts[2]);
        
        if (isNaN(day) || isNaN(month) || isNaN(year) || day < 1 || day > 31 || month < 0 || month > 11) {
            return null;
        }
        
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
