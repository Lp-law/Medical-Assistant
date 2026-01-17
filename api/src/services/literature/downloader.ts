import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

const downloadsRoot = path.resolve(process.cwd(), '..', 'downloads', 'literature');

export const ensureDownloadDir = async (knowledgeId: string): Promise<string> => {
  const target = path.join(downloadsRoot, knowledgeId);
  await mkdir(target, { recursive: true });
  return target;
};

export const downloadPdf = async (knowledgeId: string, resourceId: string, url: string): Promise<string> => {
  const dir = await ensureDownloadDir(knowledgeId);
  const filePath = path.join(dir, `${resourceId}.pdf`);
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`download_failed:${response.status}`);
  }
  await pipeline(response.body as any, createWriteStream(filePath));
  return filePath;
};

