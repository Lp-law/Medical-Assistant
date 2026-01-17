import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { Readable } from 'stream';
import { config } from './env';

const { endpoint, key, modelId } = config.ocr;

const toStream = (buffer: Buffer): Readable => {
  return Readable.from(buffer);
};

export const analyzeWithAzureOcr = async (buffer: Buffer): Promise<string> => {
  if (!endpoint || !key) {
    throw new Error('ocr-config-missing');
  }

  const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(key));
  const poller = await client.beginAnalyzeDocument(modelId, toStream(buffer));
  const result = await poller.pollUntilDone();
  if (!result.content) {
    throw new Error('ocr-empty');
  }
  return result.content;
};

