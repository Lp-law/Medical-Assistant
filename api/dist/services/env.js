"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const zod_1 = require("zod");
const envSchema = zod_1.z.object({
    PORT: zod_1.z.string().optional(),
    CORS_ORIGINS: zod_1.z.string().optional(),
    AZURE_STORAGE_CONNECTION_STRING: zod_1.z.string().optional(),
    AZURE_STORAGE_CONTAINER: zod_1.z.string().optional(),
    AZURE_OCR_ENDPOINT: zod_1.z.string().optional(),
    AZURE_OCR_KEY: zod_1.z.string().optional(),
    AZURE_OCR_MODEL_ID: zod_1.z.string().optional(),
    AZURE_SEARCH_ENDPOINT: zod_1.z.string().optional(),
    AZURE_SEARCH_API_KEY: zod_1.z.string().optional(),
    AZURE_SEARCH_INDEX: zod_1.z.string().optional(),
    AZURE_OPENAI_ENDPOINT: zod_1.z.string().optional(),
    AZURE_OPENAI_API_KEY: zod_1.z.string().optional(),
    AZURE_OPENAI_DEPLOYMENT: zod_1.z.string().optional(),
    UNPAYWALL_EMAIL: zod_1.z.string().optional(),
    PUBMED_API_KEY: zod_1.z.string().optional(),
    SEMANTIC_SCHOLAR_API_KEY: zod_1.z.string().optional(),
    AUTH_USERS: zod_1.z.string().optional(),
    JWT_SECRET: zod_1.z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
    JWT_ACCESS_TTL_MINUTES: zod_1.z.string().optional(),
    DATABASE_URL: zod_1.z.string().optional(),
    // IMAP ingestion (email → documents)
    IMAP_ENABLED: zod_1.z.string().optional(),
    IMAP_HOST: zod_1.z.string().optional(),
    IMAP_PORT: zod_1.z.string().optional(),
    IMAP_SECURE: zod_1.z.string().optional(),
    IMAP_USER: zod_1.z.string().optional(),
    IMAP_PASSWORD: zod_1.z.string().optional(),
    IMAP_MAILBOX: zod_1.z.string().optional(),
    IMAP_FROM_FILTER: zod_1.z.string().optional(),
});
const env = envSchema.parse(process.env);
const parseAuthUsers = (raw) => {
    if (!raw) {
        return [];
    }
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    }
    catch (error) {
        console.warn('[env] Failed to parse AUTH_USERS. Provide valid JSON array.', error);
        return [];
    }
};
exports.config = {
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
        secure: (env.IMAP_SECURE ?? 'true').toLowerCase() !== 'false',
        user: env.IMAP_USER ?? '',
        password: env.IMAP_PASSWORD ?? '',
        mailbox: env.IMAP_MAILBOX ?? 'INBOX',
        fromFilter: env.IMAP_FROM_FILTER ?? '',
    },
};
