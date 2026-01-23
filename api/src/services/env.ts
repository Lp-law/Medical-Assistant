import { z } from 'zod';

type AuthUserEnv = {
  username: string;
  passwordHash: string;
  role: 'admin' | 'attorney';
};

const envSchema = z.object({
  PORT: z.string().optional(),
  CORS_ORIGINS: z.string().optional(),

  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER: z.string().optional(),

  AZURE_OCR_ENDPOINT: z.string().optional(),
  AZURE_OCR_KEY: z.string().optional(),
  AZURE_OCR_MODEL_ID: z.string().optional(),

  AZURE_SEARCH_ENDPOINT: z.string().optional(),
  AZURE_SEARCH_API_KEY: z.string().optional(),
  AZURE_SEARCH_INDEX: z.string().optional(),

  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().optional(),
  UNPAYWALL_EMAIL: z.string().optional(),
  PUBMED_API_KEY: z.string().optional(),
  SEMANTIC_SCHOLAR_API_KEY: z.string().optional(),

  AUTH_USERS: z.string().optional(),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL_MINUTES: z.string().optional(),
  DATABASE_URL: z.string().optional(),

  // IMAP ingestion (email → documents)
  IMAP_ENABLED: z.string().optional(),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.string().optional(),
  IMAP_SECURE: z.string().optional(),
  // Backwards/alias support
  IMAP_TLS: z.string().optional(),
  IMAP_USER: z.string().optional(),
  IMAP_PASSWORD: z.string().optional(),
  IMAP_MAILBOX: z.string().optional(),
  // Backwards/alias support (older UI name)
  EMAIL_INGESTION_FOLDER: z.string().optional(),
  IMAP_FROM_FILTER: z.string().optional(),
});

const env = envSchema.parse(process.env);

const parseAuthUsers = (raw?: string): AuthUserEnv[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as AuthUserEnv[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('[env] Failed to parse AUTH_USERS. Provide valid JSON array.', error);
    return [];
  }
};

export const config = {
  port: env.PORT ? Number(env.PORT) : 4000,
  corsOrigins: env.CORS_ORIGINS ? env.CORS_ORIGINS.split(',').map((o) => o.trim()) : ['http://localhost:3000'],
  storage: {
    connectionString: env.AZURE_STORAGE_CONNECTION_STRING ?? '',
    container: env.AZURE_STORAGE_CONTAINER ?? 'lexmedical-pdfs',
  },
  ocr: {
    endpoint: env.AZURE_OCR_ENDPOINT ?? '',
    key: env.AZURE_OCR_KEY ?? '',
    modelId: env.AZURE_OCR_MODEL_ID ?? 'prebuilt-read',
  },
  search: {
    endpoint: env.AZURE_SEARCH_ENDPOINT ?? '',
    apiKey: env.AZURE_SEARCH_API_KEY ?? '',
    index: env.AZURE_SEARCH_INDEX ?? 'lexmedical-knowledge',
  },
  openai: {
    endpoint: env.AZURE_OPENAI_ENDPOINT ?? '',
    apiKey: env.AZURE_OPENAI_API_KEY ?? '',
    deployment: env.AZURE_OPENAI_DEPLOYMENT ?? '',
  },
  literature: {
    unpaywallEmail: env.UNPAYWALL_EMAIL ?? '',
    pubmedApiKey: env.PUBMED_API_KEY ?? '',
    semanticScholarApiKey: env.SEMANTIC_SCHOLAR_API_KEY ?? '',
  },
  auth: {
    users: parseAuthUsers(env.AUTH_USERS),
    jwtSecret: env.JWT_SECRET,
    accessTtlMinutes: env.JWT_ACCESS_TTL_MINUTES ? Number(env.JWT_ACCESS_TTL_MINUTES) : 30,
  },
  databaseUrl: env.DATABASE_URL ?? '',
  imap: {
    enabled: (env.IMAP_ENABLED ?? '').toLowerCase() === 'true',
    host: env.IMAP_HOST ?? '',
    port: env.IMAP_PORT ? Number(env.IMAP_PORT) : 993,
    // Prefer IMAP_SECURE; fallback to IMAP_TLS; default true
    secure: ((env.IMAP_SECURE ?? env.IMAP_TLS ?? 'true') as string).toLowerCase() !== 'false',
    user: env.IMAP_USER ?? '',
    password: env.IMAP_PASSWORD ?? '',
    mailbox: env.IMAP_MAILBOX ?? env.EMAIL_INGESTION_FOLDER ?? 'INBOX',
    fromFilter: env.IMAP_FROM_FILTER ?? '',
  },
};

