import { BlobServiceClient } from '@azure/storage-blob';

const getConnectionString = (): string => {
  const cs = process.env.AZURE_STORAGE_CONNECTION_STRING ?? '';
  if (!cs) {
    throw new Error('storage_connection_string_missing');
  }
  return cs;
};

const getContainerName = (): string => {
  return process.env.AZURE_STORAGE_CONTAINER?.trim() || 'book-chapters';
};

export const uploadTextHealthcheck = async (): Promise<{ container: string; blobName: string; etag?: string }> => {
  const container = getContainerName();
  const blobName = `healthcheck/${Date.now()}.txt`;
  const payload = Buffer.from(`ok ${new Date().toISOString()}`, 'utf-8');

  const service = BlobServiceClient.fromConnectionString(getConnectionString());
  const containerClient = service.getContainerClient(container);
  await containerClient.createIfNotExists();
  const blobClient = containerClient.getBlockBlobClient(blobName);
  const response = await blobClient.uploadData(payload, {
    blobHTTPHeaders: { blobContentType: 'text/plain; charset=utf-8' },
  });

  return {
    container,
    blobName,
    etag: response.etag,
  };
};
