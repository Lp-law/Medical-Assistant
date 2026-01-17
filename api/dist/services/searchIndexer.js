"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushDocumentToSearch = void 0;
const search_documents_1 = require("@azure/search-documents");
const env_1 = require("./env");
const { endpoint, apiKey, index } = env_1.config.search;
let searchClient = null;
if (endpoint && apiKey) {
    searchClient = new search_documents_1.SearchClient(endpoint, index, new search_documents_1.AzureKeyCredential(apiKey));
}
const pushDocumentToSearch = async (document) => {
    if (!searchClient) {
        console.warn('[search] missing endpoint/API key, skipping indexing');
        return;
    }
    await searchClient.mergeOrUploadDocuments([document]);
};
exports.pushDocumentToSearch = pushDocumentToSearch;
