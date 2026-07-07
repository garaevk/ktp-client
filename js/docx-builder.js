/**
 * Создатель .docx документов с КТП
 */
class DocxBuilder {
    constructor() {
        this.doc = null;
    }

    async create(data) {
        try {
            const { schoolName, subject, grade, level, lessons } = data;

            const totalHours = lessons.reduce((sum, l) => sum + (parseInt(l.hours) || 0), 0);
            const controlCount = lessons.filter(l => l.control && l.control !== '0').length || 8;
            const practicalCount = lessons.filter(l => l.practical && l.practical !== '0').length || 0;

            if (typeof docx === 'undefined') {
                throw new Error('Библиотека docx не загружена');
            }

            const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
                  AlignmentType, WidthType, HeadingLevel, BorderStyle, ShadingType } = docx;

            const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
            const borders = { top: border, bottom: border, left: border, right: border };

            // Титульная страница
            const titleChildren = [];
            titleChildren.push(this.p('МИНИСТЕРСТВО ПРОСВЕЩЕНИЯ РОССИЙСКОЙ ФЕДЕРАЦИИ', 14, true));
            if (schoolName) {
                titleChildren.push(this.p(schoolName, 12, true));
            }
            titleChildren.push(this.p('', 14, false));
            titleChildren.push(this.p('', 14, false));
            titleChildren.push(this.p('ПОУРОЧНОЕ ПЛАНИРОВАНИЕ', 20, true));
            titleChildren.push(this.p('', 14, false));
            titleChildren.push(this.p('РАБОЧАЯ ПРОГРАММА', 14, true));
            titleChildren.push(this.p('(ID 7784743)', 14, false));
            titleChildren.push(this.p('', 14, false));

            let subjectLine = `учебного предмета «${subject}`;
            if (level) subjectLine += `. ${level}`;
            subjectLine += '»';
            titleChildren.push(this.p(subjectLine, 14, true));
            titleChildren.push(this.p(`для обучающихся ${grade} классов`, 14, false));
            for (let i = 0; i < 4; i++) titleChildren.push(this.p('', 14, false));

            // Таблица
            const tableChildren = [];
            tableChildren.push(this.p('Календарно-тематическое планирование', 12, true));
            tableChildren.push(this.p(`по ${subject.toLowerCase()} для ${grade} класса`, 11, false));

            // Заголовки таблицы
            const header = ['№ п/п', 'Тема урока', 'Всего', 'Контрольные\nработы', 'Практические\nработы', 'Дата проведения', 'Электронные цифровые\nобразовательные ресурсы'];

            const colWidths = [635, 7087, 1008, 1344, 1344, 1344, 3703];

            const tableRows = [];

            // Строка заголовков
            tableRows.push(new TableRow({
                children: header.map((text, i) => this.headerCell(text, colWidths[i]))
            }));

            // Строки с уроками
            for (const lesson of lessons) {
                tableRows.push(new TableRow({
                    children: [
                        this.cell(lesson.num || '', colWidths[0]),
                        this.cell(lesson.theme || '', colWidths[1], AlignmentType.LEFT),
                        this.cell(lesson.hours || '', colWidths[2]),
                        this.cell(lesson.control || '', colWidths[3]),
                        this.cell(lesson.practical || '', colWidths[4]),
                        this.cell(lesson.date || '', colWidths[5]),
                        this.cell(lesson.resources || '', colWidths[6])
                    ]
                }));
            }

            // Итоговая строка
            tableRows.push(new TableRow({
                children: [
                    this.headerCell('Итого', colWidths[0]),
                    this.headerCell('', colWidths[1]),
                    this.headerCell(String(totalHours || lessons.length), colWidths[2]),
                    this.headerCell(String(controlCount), colWidths[3]),
                    this.headerCell(String(practicalCount), colWidths[4]),
                    this.headerCell('', colWidths[5]),
                    this.headerCell('', colWidths[6])
                ]
            }));

            const table = new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE }
            });

            tableChildren.push(table);

            this.doc = new Document({
                sections: [
                    {
                        properties: {
                            page: {
                                size: { orientation: docx.PageOrientation.LANDSCAPE, width: 16838, height: 11906 },
                                margin: { top: 1701, bottom: 851, left: 1134, right: 1134 }
                            }
                        },
                        children: titleChildren
                    },
                    {
                        properties: {
                            page: {
                                size: { orientation: docx.PageOrientation.LANDSCAPE, width: 16838, height: 11906 },
                                margin: { top: 1701, bottom: 851, left: 1134, right: 1134 }
                            }
                        },
                        children: tableChildren
                    }
                ]
            });

            return await Packer.toBlob(this.doc);
        } catch (error) {
            console.error('Ошибка создания .docx:', error);
            throw new Error('Не удалось создать документ: ' + error.message);
        }
    }

    p(text, size, bold) {
        return new docx.Paragraph({
            alignment: docx.AlignmentType.CENTER,
            spacing: { after: 0, before: 0, line: 340 },
            children: [new docx.TextRun({ text: text, bold: bold, size: size * 2, font: 'Times New Roman' })]
        });
    }

    headerCell(text, width) {
        return new docx.TableCell({
            borders: { top: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" }, bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" }, left: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" }, right: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" } },
            shading: { type: docx.ShadingType.CLEAR, fill: 'D9E2F3' },
            verticalAlign: docx.VerticalAlign.CENTER,
            width: { size: width, type: docx.WidthType.DXA },
            children: [new docx.Paragraph({
                alignment: docx.AlignmentType.CENTER,
                spacing: { after: 0, before: 0, line: 240 },
                children: [new docx.TextRun({ text: text, bold: true, size: 20, font: 'Times New Roman' })]
            })]
        });
    }

    cell(text, width, alignment = docx.AlignmentType.CENTER) {
        return new docx.TableCell({
            borders: { top: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" }, bottom: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" }, left: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" }, right: { style: docx.BorderStyle.SINGLE, size: 1, color: "000000" } },
            verticalAlign: docx.VerticalAlign.CENTER,
            width: { size: width, type: docx.WidthType.DXA },
            children: [new docx.Paragraph({
                alignment: alignment,
                spacing: { after: 0, before: 0, line: 240 },
                children: [new docx.TextRun({ text: text, size: 20, font: 'Times New Roman' })]
            })]
        });
    }

    download(blob, filename) {
        if (typeof saveAs !== 'undefined') {
            saveAs(blob, filename);
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }
}
