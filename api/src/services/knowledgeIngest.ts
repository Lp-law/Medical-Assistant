import { v4 as uuid } from 'uuid';
import { uploadPdfToStorage } from './storageClient';
import { runOcrPipeline } from './ocr/ocrPipeline';
import { generateChapterMetadata } from './openAIClient';
import { pushDocumentToSearch } from './searchIndexer';
import { buildInsights, deriveRules, deriveTags } from '../utils/insights';

interface IngestRequest {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  docType: 'chapter' | 'precedent';
  tags: string[];
  metadata: Record<string, unknown>;
  forceEnhancedOcr?: boolean;
}

export const orchestrateIngestion = async (request: IngestRequest) => {
  const docId = uuid();
  const uploadedUrl = await uploadPdfToStorage(request.buffer, request.originalName, request.mimeType);

  const ocrResult = await runOcrPipeline(request.buffer, { forceEnhanced: request.forceEnhancedOcr });
  const text = ocrResult.text;
  if (!text) {
    throw new Error('text-extraction-failed');
  }

  const autoTags = deriveTags(text);
  const combinedTags = Array.from(new Set([...(request.tags ?? []), ...autoTags]));
  const rules = deriveRules(text);
  const metadata = await generateChapterMetadata(text);
  const insights = buildInsights(metadata.summary, combinedTags);

  const indexedDoc = {
    title: metadata.title,
    summary: metadata.summary,
    content: text,
    tags: combinedTags,
    ocrMode: ocrResult.mode,
    score: {
      value: ocrResult.metrics.score,
      breakdown: {
        ocr: {
          value: ocrResult.metrics.score,
          reasons: ocrResult.metrics.reasons,
          mode: ocrResult.mode,
        },
      },
    },
    rules,
    docType: request.docType,
    sourceFile: request.originalName,
    sourceUrl: uploadedUrl,
    metadata: {
      ...request.metadata,
      size: request.size,
      ocrComparison: ocrResult.comparison,
    },
    createdAt: new Date().toISOString(),
  };

  const searchableDoc = {
    id: docId,
    ...indexedDoc,
  };

  await pushDocumentToSearch(searchableDoc);

  return {
    id: docId,
    ...indexedDoc,
    insights,
  };
};

