"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeWithAzureOcr = void 0;
const ai_form_recognizer_1 = require("@azure/ai-form-recognizer");
const stream_1 = require("stream");
const env_1 = require("./env");
const { endpoint, key, modelId } = env_1.config.ocr;
const toStream = (buffer) => {
    return stream_1.Readable.from(buffer);
};
const analyzeWithAzureOcr = async (buffer) => {
    if (!endpoint || !key) {
        throw new Error('ocr-config-missing');
    }
    const client = new ai_form_recognizer_1.DocumentAnalysisClient(endpoint, new ai_form_recognizer_1.AzureKeyCredential(key));
    const poller = await client.beginAnalyzeDocument(modelId, toStream(buffer));
    const result = await poller.pollUntilDone();
    if (!result.content) {
        throw new Error('ocr-empty');
    }
    return result.content;
};
exports.analyzeWithAzureOcr = analyzeWithAzureOcr;
