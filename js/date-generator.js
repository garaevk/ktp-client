/**
 * Генератор дат для уроков
 */

const DEFAULT_QUARTERS = [
    { name: 'I четверть',  start: '2026-09-01', end: '2026-10-28' },
    { name: 'II четверть', start: '2026-11-09', end: '2026-12-30' },
    { name: 'III четверть', start: '2027-01-10', end: '2027-03-31' },
    { name: 'IV четверть', start: '2027-04-05', end: '2027-05-26' },
];

const DEFAULT_HOLIDAY_RANGES = [
    { name: 'Осенние каникулы',  start: '2026-10-29', end: '2026-11-08' },
    { name: 'Зимние каникулы',   start: '2026-12-31', end: '2027-01-09' },
    { name: 'Весенние каникулы', start: '2027-04-01', end: '2027-04-04' },
];

const DEFAULT_SPECIFIC_HOLIDAYS = [
    { date: '2027-03-08', name: 'Международный женский день' },
    { date: '2027-03-09', name: 'Выходной (перенос)' },
    { date: '2027-05-01', name: 'Праздник Весны и Труда' },
    { date: '2027-05-10', name: 'Выходной' },
    { date: '2027-05-16', name: 'Выходной' },
];

class DateGenerator {
    constructor() {
        this.quarters = [];
        this.holidays = [];
        this.specialHolidays = [];
        this.daysOfWeek = [];
        this.lessonsPerDayMap = {};
    }

    /**
     * Установить параметры генерации
     * @param {Object} config - Конфигурация
     */
    setConfig(config) {
        // Если четверти не заданы — используем дефолтные
        this.quarters = (config.quarters && config.quarters.length > 0)
            ? config.quarters
            : DEFAULT_QUARTERS;

        // Если каникулы не заданы — используем дефолтные
        this.holidays = (config.holidays && config.holidays.length > 0)
            ? config.holidays
            : DEFAULT_HOLIDAY_RANGES;

        // Если праздники не заданы — используем дефолтные
        this.specialHolidays = (config.specialHolidays && config.specialHolidays.length > 0)
            ? config.specialHolidays
            : DEFAULT_SPECIFIC_HOLIDAYS;

        this.daysOfWeek = config.daysOfWeek || [1, 2, 3, 4, 5];
        this.lessonsPerDayMap = config.lessonsPerDayMap || {};
    }

    /**
     * Сгенерировать даты для уроков
     * @param {number} totalLessons - Общее количество уроков
     * @returns {Array} - Массив дат (строки в формате ДД.ММ.ГГГГ)
     */
    generate(totalLessons) {
        const dates = [];
        const availableDates = this.getAvailableDates();

        let lessonIndex = 0;

        for (const date of availableDates) {
            if (lessonIndex >= totalLessons) {
                break;
            }

            const dayOfWeek = date.getDay();
            const lessonsForDay = this.lessonsPerDayMap[dayOfWeek] || 1;

            for (let i = 0; i < lessonsForDay && lessonIndex < totalLessons; i++) {
                dates.push(this.formatDate(date));
                lessonIndex++;
            }
        }

        while (dates.length < totalLessons) {
            dates.push('');
        }

        return dates;
    }

    /**
     * Получить все доступные даты
     * @returns {Array} - Массив объектов Date
     */
    getAvailableDates() {
        const dates = [];

        for (const quarter of this.quarters) {
            const startDate = this.parseDate(quarter.start);
            const endDate = this.parseDate(quarter.end);

            if (!startDate || !endDate) continue;

            let currentDate = new Date(startDate);

            while (currentDate <= endDate) {
                const dayOfWeek = currentDate.getDay();

                if (this.daysOfWeek.includes(dayOfWeek)) {
                    if (!this.isHoliday(currentDate) && !this.isSpecialHoliday(currentDate)) {
                        dates.push(new Date(currentDate));
                    }
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }
        }

        return dates;
    }

    /**
     * Парсинг даты из строки (YYYY-MM-DD или ДД.ММ.ГГГГ)
     */
    parseDate(val) {
        if (!val) return null;
        if (val instanceof Date) return val;

        // Формат YYYY-MM-DD
        if (typeof val === 'string' && val.includes('-')) {
            const parts = val.split('-');
            if (parts.length === 3) {
                return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            }
        }

        // Формат ДД.ММ.ГГГГ
        if (typeof val === 'string' && val.includes('.')) {
            const parts = val.split('.');
            if (parts.length === 3) {
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            }
        }

        return null;
    }

    /**
     * Проверить, является ли дата каникулами
     */
    isHoliday(date) {
        for (const holiday of this.holidays) {
            const start = this.parseDate(holiday.start);
            const end = this.parseDate(holiday.end);

            if (!start || !end) continue;

            // Сравниваем по дню (без времени)
            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const s = new Date(start.getFullYear(), start.getMonth(), start.getDate());
            const e = new Date(end.getFullYear(), end.getMonth(), end.getDate());

            if (d >= s && d <= e) {
                return true;
            }
        }

        return false;
    }

    /**
     * Проверить, является ли дата праздничным днём
     */
    isSpecialHoliday(date) {
        for (const specialHoliday of this.specialHolidays) {
            const holidayDate = this.parseDate(specialHoliday.date);
            if (!holidayDate) continue;

            const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
            const h = new Date(holidayDate.getFullYear(), holidayDate.getMonth(), holidayDate.getDate());

            if (d.getTime() === h.getTime()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Форматировать дату в строку ДД.ММ.ГГГГ
     */
    formatDate(date) {
        if (!date) return '';

        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();

        return `${day}.${month}.${year}`;
    }

    /**
     * Получить статистику генерации
     */
    getStats(dates) {
        const total = dates.length;
        const withDates = dates.filter(d => d !== '').length;
        const withoutDates = total - withDates;

        return {
            total: total,
            withDates: withDates,
            withoutDates: withoutDates
        };
    }
}
