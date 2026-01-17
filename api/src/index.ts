import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { authRouter } from './routes/auth';
import { ingestRouter } from './routes/ingest';
import { casesRouter } from './routes/cases';
import { knowledgeRouter } from './routes/knowledge';
import { literatureRouter } from './routes/literature';
import { notificationsRouter } from './routes/notifications';
import { startCaseRetentionJobs } from './jobs/caseRetention';
import { config } from './services/env';

const app = express();

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/ingest', ingestRouter);
app.use('/api/cases', casesRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/literature', literatureRouter);
app.use('/api/notifications', notificationsRouter);

const port = config.port;
app.listen(port, () => {
  console.log(`LexMedical API listening on port ${port}`);
  startCaseRetentionJobs();
});

