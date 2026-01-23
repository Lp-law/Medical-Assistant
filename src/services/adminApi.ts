import { apiRequest } from './api';

export interface EmailIngestNowResponse {
  processedMessages: number;
  documentsCreated: number;
  lastUid: number | string;
  success: boolean;
  error?: string;
}

export const runEmailIngestNow = async (): Promise<EmailIngestNowResponse> => {
  return await apiRequest<EmailIngestNowResponse>('/admin/email-ingest-now', { method: 'POST' });
};


