import { apiRequest, type ApiError } from './api';

export const ASSISTANT_REQUEST_TIMEOUT_MS = 18000; // 18 seconds

export type AssistantDocumentHit = {
  id: string;
  title: string;
  summary: string;
  contentSnippet: string;
  categoryName: string;
  source: string;
  attachmentUrl: string | null;
  createdAt: string;
};

export type AssistantSearchResponse = {
  queries: string[];
  documents: AssistantDocumentHit[];
};

export const assistantSearch = async (
  question: string,
  input?: { limit?: number; categoryName?: string },
): Promise<AssistantSearchResponse> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ASSISTANT_REQUEST_TIMEOUT_MS);
  try {
    const res = await apiRequest<AssistantSearchResponse>('/assistant/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        limit: input?.limit ?? 10,
        categoryName: input?.categoryName,
      }),
      signal: controller.signal,
    });
    return res;
  } catch (e) {
    if ((e as Error).name === 'AbortError') {
      const err = new Error('timeout') as ApiError;
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
};


