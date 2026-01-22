import { BlobServiceClient } from '@azure/storage-blob';
import { v4 as uuid } from 'uuid';
import { config } from './env';

const { connectionString, container } = config.storage;

let blobServiceClient: BlobServiceClient | null = null;
if (connectionString) {
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
}

export const uploadFileToStorage = async (
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<string | null> => {
  if (!blobServiceClient) {
    console.warn('[storage] missing connection string, skipping upload');
    return null;
  }

  const containerClient = blobServiceClient.getContainerClient(container);
  await containerClient.createIfNotExists();
  const blobName = `${uuid()}-${filename}`.replace(/\s+/g, '_');
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: mimeType || 'application/pdf' },
  });
  return blockBlobClient.url;
};

// Backwards-compatible alias (existing ingestion code expects PDF name)
export const uploadPdfToStorage = uploadFileToStorage;

