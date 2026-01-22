import cron from 'node-cron';
import { runImapIngestionCycle } from '../services/imapProcessor';
import { config } from '../services/env';

export const runEmailFetcherOnce = async () => {
  if (!config.imap.enabled) {
    return { mailbox: config.imap.mailbox, fetched: 0, processed: 0, skipped: 0, lastUid: BigInt(0) };
  }
  return await runImapIngestionCycle();
};

export const startEmailFetcherJobs = (): void => {
  if (!config.imap.enabled) {
    return;
  }
  console.log('[emailFetcher] IMAP ingestion enabled. Scheduling every 10 minutes.');
  // Every 10 minutes
  cron.schedule(
    '*/10 * * * *',
    () => {
      runEmailFetcherOnce().catch((error) => console.error('[emailFetcher] failed', error));
    },
    { timezone: 'UTC' },
  );
};


