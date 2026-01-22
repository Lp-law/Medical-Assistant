"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadPdfToStorage = exports.uploadFileToStorage = void 0;
const storage_blob_1 = require("@azure/storage-blob");
const uuid_1 = require("uuid");
const env_1 = require("./env");
const { connectionString, container } = env_1.config.storage;
let blobServiceClient = null;
if (connectionString) {
    blobServiceClient = storage_blob_1.BlobServiceClient.fromConnectionString(connectionString);
}
const uploadFileToStorage = async (buffer, filename, mimeType) => {
    if (!blobServiceClient) {
        console.warn('[storage] missing connection string, skipping upload');
        return null;
    }
    const containerClient = blobServiceClient.getContainerClient(container);
    await containerClient.createIfNotExists();
    const blobName = `${(0, uuid_1.v4)()}-${filename}`.replace(/\s+/g, '_');
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    await blockBlobClient.uploadData(buffer, {
        blobHTTPHeaders: { blobContentType: mimeType || 'application/pdf' },
    });
    return blockBlobClient.url;
};
exports.uploadFileToStorage = uploadFileToStorage;
// Backwards-compatible alias (existing ingestion code expects PDF name)
exports.uploadPdfToStorage = exports.uploadFileToStorage;
