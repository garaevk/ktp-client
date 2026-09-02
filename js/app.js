/**
 * Основная логика приложения КТП-генератор (клиентская версия)
 */
class KtpApp {
    constructor() {
        this.docxParser = new DocxParser();
        this.pdfParser = new PdfParser();
        this.dateGenerator = new DateGenerator();
        this.docxBuilder = new DocxBuilder();

        this.currentStep = 1;
        this.tables = [];
        this.selectedTableIndex = 0;
        this.lessons = [];
        this.calendarData = null;
        this.generatedDates = [];

        this.init();
    }

    /**
     * Инициализация приложения
     */
    init() {
        this.bindEvents();
        this.showStep(1);
    }

    /**
     * Привязать обработчики событий
     */
    bindEvents() {
        // Шаг 1: Загрузка файлов
        document.getElementById('btnLoad').addEventListener('click', () => this.handleLoad());

        // Шаг 2: Выбор таблицы
        document.getElementById('btnSelectTable').addEventListener('click', () => this.handleSelectTable());

        // Шаг 3: Настройка дат
        document.getElementById('btnAddQuarter').addEventListener('click', () => this.addQuarter());
        document.getElementById('btnAddHoliday').addEventListener('click', () => this.addHoliday());
        document.getElementById('btnAddSpecialHoliday').addEventListener('click', () => this.addSpecialHoliday());
        document.getElementById('btnGenerate').addEventListener('click', () => this.handleGenerate());

        // Обработчики для чекбоксов дней недели
        document.querySelectorAll('.day-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => this.handleDayCheckboxChange(e));
        });

        // Шаг 4: Результат
        document.getElementById('btnDownload').addEventListener('click', () => this.handleDownload());
        document.getElementById('btnRestart').addEventListener('click', () => this.restart());
    }

    /**
     * Обработать изменение чекбокса дня недели
     */
    handleDayCheckboxChange(e) {
        const day = e.target.value;
        const input = document.querySelector(`.lessons-per-day[data-day="${day}"]`);
        if (input) {
            input.disabled = !e.target.checked;
            if (!e.target.checked) {
                input.value = 1;
            }
        }
    }

    /**
     * Показать шаг
     * @param {number} step - Номер шага
     */
    showStep(step) {
        document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
        document.getElementById(`step${step}`).classList.add('active');
        this.currentStep = step;
    }

    /**
     * Показать загрузку
     * @param {boolean} show - Показать или скрыть
     */
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (show) {
            loading.classList.remove('hidden');
        } else {
            loading.classList.add('hidden');
        }
    }

    /**
     * Показать ошибку
     * @param {string} message - Сообщение об ошибке
     */
    showError(message) {
        const error = document.getElementById('error');
        error.textContent = message;
        error.classList.remove('hidden');
        setTimeout(() => {
            error.classList.add('hidden');
        }, 5000);
    }

    /**
     * Показать сообщение об успехе
     * @param {string} message - Сообщение
     */
    showSuccess(message) {
        const error = document.getElementById('error');
        error.textContent = message;
        error.style.background = '#4CAF50';
        error.classList.remove('hidden');
        setTimeout(() => {
            error.classList.add('hidden');
            error.style.background = '#ff4444';
        }, 3000);
    }

    /**
     * Обработать загрузку файлов
     */
    async handleLoad() {
        const ktpFile = document.getElementById('ktpFile').files[0];
        const calendarFile = document.getElementById('calendarFile').files[0];

        if (!ktpFile) {
            this.showError('Пожалуйста, выберите файл КТП (.docx)');
            return;
        }

        this.showLoading(true);

        try {
            // Парсить .docx
            this.tables = await this.docxParser.parse(ktpFile);

            if (this.tables.length === 0) {
                throw new Error('В документе не найдено таблиц');
            }

            // Автоматически выбрать таблицу с уроками
            this.selectedTableIndex = this.docxParser.findLessonsTable(this.tables);

            // Парсить PDF календарь (если загружен)
            if (calendarFile) {
                this.calendarData = await this.pdfParser.parse(calendarFile);
            }

            // Показать шаг 2
            this.renderTables();
            this.showStep(2);
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Отрисовать список таблиц
     */
    renderTables() {
        const container = document.getElementById('tablesList');
        container.innerHTML = '';

        this.tables.forEach((table, index) => {
            const card = document.createElement('div');
            card.className = 'table-card' + (index === this.selectedTableIndex ? ' selected' : '');
            card.innerHTML = `
                <h3>Таблица ${index + 1}</h3>
                <p>${table.description}</p>
                <p>Строк: ${table.rowCount}, Колонок: ${table.cols}</p>
            `;
            card.addEventListener('click', () => {
                this.selectedTableIndex = index;
                this.renderTables();
            });
            container.appendChild(card);
        });
    }

    /**
     * Обработать выбор таблицы
     */
    handleSelectTable() {
        const table = this.tables[this.selectedTableIndex];
        this.lessons = this.docxParser.extractLessons(table);

        if (this.lessons.length === 0) {
            this.showError('В выбранной таблице не найдено уроков');
            return;
        }

        // Инициализировать настройки дат
        this.initDateConfig();
        this.showStep(3);
    }

    /**
     * Инициализировать настройки дат
     */
    initDateConfig() {
        // Дни недели (по умолчанию Вт и Чт)
        const daysOfWeek = [2, 4];
        
        document.querySelectorAll('.day-checkbox').forEach(cb => {
            const day = parseInt(cb.value);
            cb.checked = daysOfWeek.includes(day);
        });
        
        document.querySelectorAll('.lessons-per-day').forEach(input => {
            const day = parseInt(input.getAttribute('data-day'));
            const checkbox = document.querySelector(`.day-checkbox[value="${day}"]`);
            if (checkbox) {
                input.disabled = !checkbox.checked;
                if (checkbox.checked && !input.value) {
                    input.value = 1;
                }
            }
        });

        // Четверти — если PDF не распарсился, добавить дефолтные
        if (this.calendarData && this.calendarData.quarters && this.calendarData.quarters.length > 0) {
            this.calendarData.quarters.forEach(q => this.addQuarter(q));
        } else {
            // Дефолтные четверти 2025-2026
            this.addQuarter({ name: 'I четверть', start: '2025-09-01', end: '2025-10-26' });
            this.addQuarter({ name: 'II четверть', start: '2025-11-07', end: '2025-12-30' });
            this.addQuarter({ name: 'III четверть', start: '2026-01-12', end: '2026-03-27' });
            this.addQuarter({ name: 'IV четверть', start: '2026-04-06', end: '2026-05-26' });
        }

        // Каникулы
        if (this.calendarData && this.calendarData.holidays && this.calendarData.holidays.length > 0) {
            this.calendarData.holidays.forEach(h => this.addHoliday(h));
        } else {
            this.addHoliday({ name: 'Осенние каникулы', start: '2025-10-27', end: '2025-11-06' });
            this.addHoliday({ name: 'Зимние каникулы', start: '2025-12-31', end: '2026-01-11' });
            this.addHoliday({ name: 'Весенние каникулы', start: '2026-03-28', end: '2026-04-05' });
        }

        // Праздничные дни — всегда начинаем с дефолтных
        const defaultHolidays = [
            { date: '2025-11-04', name: 'День народного единства' },
            { date: '2025-11-06', name: 'Дополнительный выходной' },
            { date: '2026-02-23', name: 'День защитника Отечества' },
            { date: '2026-03-08', name: 'Международный женский день' },
            { date: '2026-03-09', name: 'Выходной (перенос)' },
            { date: '2026-05-01', name: 'Праздник Весны и Труда' },
            { date: '2026-05-09', name: 'День Победы' }
        ];
        
        // Добавляем дефолтные праздники
        defaultHolidays.forEach(sh => this.addSpecialHoliday(sh));
        
        // Добавляем праздники из PDF, которых нет в дефолтных
        if (this.calendarData && this.calendarData.specialHolidays && this.calendarData.specialHolidays.length > 0) {
            this.calendarData.specialHolidays.forEach(sh => {
                const dateStr = this.formatDateForInput(sh.date);
                const exists = defaultHolidays.some(dh => this.formatDateForInput(dh.date) === dateStr);
                if (!exists) {
                    this.addSpecialHoliday(sh);
                }
            });
        }
    }

    /**
     * Добавить четверть
     * @param {Object} data - Данные четверти
     */
    addQuarter(data = {}) {
        const container = document.getElementById('quartersList');
        const item = document.createElement('div');
        item.className = 'quarter-item';
        item.innerHTML = `
            <input type="text" placeholder="Название" value="${data.name || ''}">
            <input type="date" value="${data.start ? this.formatDateForInput(data.start) : ''}">
            <input type="date" value="${data.end ? this.formatDateForInput(data.end) : ''}">
            <button onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(item);
    }

    /**
     * Добавить каникулы
     * @param {Object} data - Данные каникул
     */
    addHoliday(data = {}) {
        const container = document.getElementById('holidaysList');
        const item = document.createElement('div');
        item.className = 'holiday-item';
        item.innerHTML = `
            <input type="text" placeholder="Название" value="${data.name || ''}">
            <input type="date" value="${data.start ? this.formatDateForInput(data.start) : ''}">
            <input type="date" value="${data.end ? this.formatDateForInput(data.end) : ''}">
            <button onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(item);
    }

    /**
     * Добавить праздничный день
     * @param {Object} data - Данные праздничного дня
     */
    addSpecialHoliday(data = {}) {
        const container = document.getElementById('specialHolidaysList');
        const item = document.createElement('div');
        item.className = 'special-holiday-item';
        item.innerHTML = `
            <input type="date" value="${data.date ? this.formatDateForInput(data.date) : ''}">
            <input type="text" placeholder="Название" value="${data.name || ''}">
            <button onclick="this.parentElement.remove()">✕</button>
        `;
        container.appendChild(item);
    }

    /**
     * Форматировать дату для input[type="date"]
     * @param {Date|string} date - Дата
     * @returns {string} - Дата в формате YYYY-MM-DD
     */
    formatDateForInput(date) {
        if (!date) return '';
        if (typeof date === 'string') {
            const parts = date.split('.');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    }

    /**
     * Обработать генерацию дат
     */
    handleGenerate() {
        this.showLoading(true);

        try {
            // Собрать конфигурацию
            const config = this.collectConfig();

            // Настроить генератор
            this.dateGenerator.setConfig(config);

            // Сгенерировать даты
            this.generatedDates = this.dateGenerator.generate(this.lessons.length);

            // Применить даты к урокам
            this.lessons.forEach((lesson, index) => {
                lesson.date = this.generatedDates[index] || '';
            });

            // Показать результат
            this.renderResult();
            this.showStep(4);
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Собрать конфигурацию из формы
     * @returns {Object} - Конфигурация
     */
    collectConfig() {
        // Дни недели
        const daysOfWeek = [];
        document.querySelectorAll('.day-checkbox:checked').forEach(cb => {
            daysOfWeek.push(parseInt(cb.value));
        });

        // Уроки в день для каждого дня недели
        const lessonsPerDayMap = {};
        document.querySelectorAll('.lessons-per-day').forEach(input => {
            const day = parseInt(input.dataset.day);
            const count = parseInt(input.value) || 1;
            if (daysOfWeek.includes(day) && count > 0) {
                lessonsPerDayMap[day] = count;
            }
        });

        // Четверти
        const quarters = [];
        document.querySelectorAll('#quartersList .quarter-item').forEach(item => {
            const inputs = item.querySelectorAll('input');
            const name = inputs[0].value;
            const start = inputs[1].value;
            const end = inputs[2].value;
            
            if (name && start && end) {
                quarters.push({
                    name: name,
                    start: start,
                    end: end
                });
            }
        });

        // Каникулы
        const holidays = [];
        document.querySelectorAll('#holidaysList .holiday-item').forEach(item => {
            const inputs = item.querySelectorAll('input');
            const name = inputs[0].value;
            const start = inputs[1].value;
            const end = inputs[2].value;
            
            if (name && start && end) {
                holidays.push({
                    name: name,
                    start: start,
                    end: end
                });
            }
        });

        // Праздничные дни
        const specialHolidays = [];
        document.querySelectorAll('#specialHolidaysList .special-holiday-item').forEach(item => {
            const inputs = item.querySelectorAll('input');
            const date = inputs[0].value;
            const name = inputs[1].value;
            
            if (date && name) {
                specialHolidays.push({
                    date: date,
                    name: name
                });
            }
        });

        return {
            quarters: quarters,
            holidays: holidays,
            specialHolidays: specialHolidays,
            daysOfWeek: daysOfWeek,
            lessonsPerDayMap: lessonsPerDayMap
        };
    }

    /**
     * Отрисовать результат
     */
    renderResult() {
        const stats = this.dateGenerator.getStats(this.generatedDates);
        const container = document.getElementById('resultInfo');
        
        container.innerHTML = `
            <h3>Генерация завершена</h3>
            <p><strong>Всего уроков:</strong> ${stats.total}</p>
            <p><strong>С датами:</strong> ${stats.withDates}</p>
            <p><strong>Без дат:</strong> ${stats.withoutDates}</p>
        `;
    }

    /**
     * Обработать скачивание документа
     */
    async handleDownload() {
        this.showLoading(true);

        try {
            const schoolName = document.getElementById('schoolName').value || '';
            const grade = document.getElementById('grade').value || '';
            const subject = document.getElementById('subject').value || '';
            const level = document.getElementById('level').value || '';

            const data = {
                schoolName: schoolName,
                subject: subject,
                grade: grade,
                level: level,
                lessons: this.lessons
            };

            const blob = await this.docxBuilder.create(data);
            const filename = `КТП_${subject}_${grade}.docx`;
            
            // Используем FileSaver.js
            if (typeof saveAs !== 'undefined') {
                saveAs(blob, filename);
            } else {
                // Fallback: создаём ссылку
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
            
            this.showSuccess('Файл успешно скачан!');
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Перезапустить приложение
     */
    restart() {
        this.tables = [];
        this.selectedTableIndex = 0;
        this.lessons = [];
        this.calendarData = null;
        this.generatedDates = [];

        document.getElementById('ktpFile').value = '';
        document.getElementById('calendarFile').value = '';
        document.getElementById('schoolName').value = '';
        document.getElementById('grade').value = '';
        document.getElementById('subject').value = '';
        document.getElementById('level').value = '';
        document.getElementById('tablesList').innerHTML = '';
        document.getElementById('quartersList').innerHTML = '';
        document.getElementById('holidaysList').innerHTML = '';
        document.getElementById('specialHolidaysList').innerHTML = '';

        // Сбросить чекбоксы дней недели
        document.querySelectorAll('.day-checkbox').forEach(cb => {
            cb.checked = false;
        });

        // Сбросить поля для количества уроков
        document.querySelectorAll('.lessons-per-day').forEach(input => {
            input.value = 1;
            input.disabled = true;
        });

        this.showStep(1);
    }
}

// Запустить приложение при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    window.ktpApp = new KtpApp();
});
