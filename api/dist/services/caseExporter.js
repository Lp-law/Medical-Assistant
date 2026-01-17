"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.exportCase = void 0;
const pdf_lib_1 = require("pdf-lib");
const prisma_1 = require("./prisma");
const wrapText = (text, maxChars) => {
    const words = text.split(/\s+/);
    const lines = [];
    let current = '';
    words.forEach((word) => {
        const next = current ? `${current} ${word}` : word;
        if (next.length > maxChars) {
            if (current)
                lines.push(current);
            current = word;
        }
        else {
            current = next;
        }
    });
    if (current)
        lines.push(current);
    return lines;
};
const buildJsonPayload = (caseRecord, documents) => ({
    case: {
        id: caseRecord.id,
        title: caseRecord.title,
        topicSummary: caseRecord.topicSummary,
        status: caseRecord.status,
        createdAt: caseRecord.createdAt,
        lastAccessedAt: caseRecord.lastAccessedAt,
        data: caseRecord.data,
    },
    knowledgeDocuments: documents,
    generatedAt: new Date().toISOString(),
});
const buildPdfBuffer = async (caseRecord, documents) => {
    const pdfDoc = await pdf_lib_1.PDFDocument.create();
    const page = pdfDoc.addPage();
    const font = await pdfDoc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const fontSize = 12;
    const { width, height } = page.getSize();
    const content = [
        `דוח תיק: ${caseRecord.title}`,
        `נושא: ${caseRecord.topicSummary}`,
        `סטטוס: ${caseRecord.status}`,
        `נוצר ב-${caseRecord.createdAt.toISOString()}`,
        '',
        'חוות דעת ותוכן מקושר:',
        ...documents.map((doc) => `• ${doc.title} (${doc.docType})`),
        '',
        'תוכן JSON מקוצר:',
        JSON.stringify(caseRecord.data, null, 2).slice(0, 900),
    ].join('\n');
    let cursorY = height - 40;
    wrapText(content, 80).forEach((line) => {
        page.drawText(line, { x: 40, y: cursorY, size: fontSize, font });
        cursorY -= 16;
        if (cursorY < 40) {
            cursorY = height - 40;
            pdfDoc.addPage();
        }
    });
    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
};
const exportCase = async (caseRecord, format) => {
    const documents = await prisma_1.prisma.knowledgeDocument.findMany({
        where: { caseId: caseRecord.id },
    });
    if (format === 'json') {
        const buffer = Buffer.from(JSON.stringify(buildJsonPayload(caseRecord, documents), null, 2), 'utf-8');
        return {
            mime: 'application/json',
            filename: `case-${caseRecord.id}.json`,
            buffer,
        };
    }
    const pdfBuffer = await buildPdfBuffer(caseRecord, documents);
    return {
        mime: 'application/pdf',
        filename: `case-${caseRecord.id}.pdf`,
        buffer: pdfBuffer,
    };
};
exports.exportCase = exportCase;
