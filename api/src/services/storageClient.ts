import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuid } from 'uuid';
import { config } from './env';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const { connectionString, container } = config.storage;

let blobServiceClient: BlobServiceClient | null = null;
if (connectionString) {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
}

// On platforms like Render, the project directory may not be writable. Use tmp by default.
const LOCAL_UPLOADS_DIR = process.env.LOCAL_UPLOADS_DIR
  ? path.resolve(process.env.LOCAL_UPLOADS_DIR)
  : path.join(os.tmpdir(), 'lexmedical-uploads');

const sanitizeFilename = (filename: string): string => {
  const base = (filename ?? 'attachment').toString().trim() || 'attachment';
  // Replace path separators and control chars; keep most unicode (Hebrew filenames etc.)
  return base
    .replace(/[\\\/]+/g, '_')
    .replace(/[\u0000-\u001F\u007F]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 180);
};

export const uploadFileToStorage = async (
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string | null> => {
  if (!buffer?.length) return null;

  // Prefer Azure Blob Storage when configured.
  if (blobServiceClient) {
    const containerClient = blobServiceClient.getContainerClient(container);
    await containerClient.createIfNotExists();
    const safeName = sanitizeFilename(filename);
    const blobName = `${uuid()}-${safeName}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, {
      blobHTTPHeaders: { blobContentType: mimeType || 'application/octet-stream' },
    });
    // Store the *source* URL in DB; the API will expose a stable authenticated download URL.
    return blockBlobClient.url;
  }

  // Fallback: store locally on disk so attachments still work in dev/self-hosted setups.
  console.warn('[storage] missing connection string, using local uploads directory');
  await fs.mkdir(LOCAL_UPLOADS_DIR, { recursive: true });
  const safeName = sanitizeFilename(filename);
  const storedName = `${uuid()}-${safeName}`;
  const fullPath = path.join(LOCAL_UPLOADS_DIR, storedName);
  await fs.writeFile(fullPath, buffer);
  // "local:" prefix is interpreted by the documents download endpoint.
  return `local:${storedName}`;
};

// Backwards-compatible alias (existing ingestion code expects PDF name)
export const uploadPdfToStorage = uploadFileToStorage;

