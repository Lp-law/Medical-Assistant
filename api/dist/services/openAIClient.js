"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateChapterMetadata = void 0;
const openai_1 = require("@azure/openai");
const env_1 = require("./env");
const { endpoint, apiKey, deployment } = env_1.config.openai;
let openAIClient = null;
if (endpoint && apiKey) {
    openAIClient = new openai_1.OpenAIClient(endpoint, new openai_1.AzureKeyCredential(apiKey));
}
const fallbackMetadata = (text) => {
    const lines = text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
    const title = lines[0]?.slice(0, 120) ?? 'פרק חדש';
    const summary = text.slice(0, 1200);
    return {
        summary,
        title,
        tags: [],
        rules: [],
    };
};
const generateChapterMetadata = async (text) => {
    if (!openAIClient || !deployment) {
        return fallbackMetadata(text);
    }
    const prompt = [
        'נתון טקסט של פרק מספר תחשיבי נזק.',
        'אנא החזר JSON במבנה הבא:',
        '{ "title": "...", "summary": "...", "tags": ["..."], "rules": ["..."] }',
        'כל התשובות בעברית.',
        'טקסט:',
        text.slice(0, 8000),
    ].join('\n');
    const response = await openAIClient.getChatCompletions(deployment, [
        { role: 'system', content: 'אתה עוזר משפטי מומחה ברשלנות רפואית.' },
        { role: 'user', content: prompt },
    ]);
    const message = response.choices?.[0]?.message?.content ?? '';
    try {
        const parsed = JSON.parse(message);
        return {
            title: parsed.title || 'פרק חדש',
            summary: parsed.summary || text.slice(0, 1200),
            tags: Array.isArray(parsed.tags) ? parsed.tags : [],
            rules: Array.isArray(parsed.rules) ? parsed.rules : [],
        };
    }
    catch (error) {
        console.warn('[openai] failed to parse response, falling back', error);
        return fallbackMetadata(text);
    }
};
exports.generateChapterMetadata = generateChapterMetadata;
