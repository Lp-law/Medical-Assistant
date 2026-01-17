import { SearchClient, AzureKeyCredential } from '@azure/search-documents';
import { config } from './env';

const { endpoint, apiKey, index } = config.search;

let searchClient: SearchClient<Record<string, unknown>> | null = null;
if (endpoint && apiKey) {
  searchClient = new SearchClient<Record<string, unknown>>(endpoint, index, new AzureKeyCredential(apiKey));
}

export const pushDocumentToSearch = async (document: Record<string, unknown>): Promise<void> => {
  if (!searchClient) {
    console.warn('[search] missing endpoint/API key, skipping indexing');
    return;
  }

  await searchClient.mergeOrUploadDocuments([document]);
};

