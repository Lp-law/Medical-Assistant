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
import { startEmailFetcherJobs } from './jobs/emailFetcher';
import { config } from './services/env';
import { documentsRouter } from './routes/documents';
import { categoriesRouter } from './routes/categories';
import { adminRouter } from './routes/admin';

const app = express();

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

const requireDatabase: express.RequestHandler = (req, res, next) => {
  // Don't block CORS preflight: cors() above should already handle and end OPTIONS preflight requests.
  if (req.method === 'OPTIONS') {
    next();
    return;
  }
  if (!config.databaseUrl) {
    res.status(503).json({ error: 'db_unconfigured' });
    return;
  }
  next();
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/ingest', requireDatabase, ingestRouter);
app.use('/api/cases', requireDatabase, casesRouter);
app.use('/api/knowledge', requireDatabase, knowledgeRouter);
app.use('/api/literature', requireDatabase, literatureRouter);
app.use('/api/notifications', requireDatabase, notificationsRouter);
app.use('/api/documents', requireDatabase, documentsRouter);
app.use('/api/categories', requireDatabase, categoriesRouter);
app.use('/api/admin', requireDatabase, adminRouter);

const port = config.port;
app.listen(port, () => {
  console.log(`LexMedical API listening on port ${port}`);
  startCaseRetentionJobs();
  startEmailFetcherJobs();
});

