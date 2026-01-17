## LexMedical Backend (API) Setup

This document explains how to run the new Node/TypeScript API that orchestrates Azure OCR, knowledge ingestion, and future RAG flows.

### 1. Prerequisites
- Azure subscription with permissions to create resources.
- Node.js 18+ installed locally.
- Existing frontend repo (this project).

### 2. Azure Resources to Provision
Create (or use existing) resources and capture their keys:

| Purpose | Service | Notes |
| --- | --- | --- |
| File storage | **Azure Storage Account** | Create blob container (e.g. `lexmedical-pdfs`). |
| OCR | **Azure AI Document Intelligence** | Use `prebuilt-read` model (or custom). |
| Knowledge search | **Azure Cognitive Search** | Create index `lexmedical-knowledge` with fields: `id (Edm.String, key)`, `title`, `summary`, `content` (Searchable), `tags` (Collection), `rules` (Collection), `docType`, `sourceFile`, `sourceUrl`, `metadata`, `createdAt`. |
| Reasoning | **Azure OpenAI** | Deploy GPT-4o/4.1; note endpoint + deployment name. |

> Tip: store secrets in **Azure Key Vault** and expose via Azure App Service settings or `.env` during local dev.

### 3. Environment Variables
Create `api/.env` with:

```
PORT=4000
CORS_ORIGINS=http://localhost:3000

AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=...
AZURE_STORAGE_CONTAINER=lexmedical-pdfs

AZURE_OCR_ENDPOINT=https://<doc-intel>.cognitiveservices.azure.com
AZURE_OCR_KEY=<doc-intel-key>
AZURE_OCR_MODEL_ID=prebuilt-read

AZURE_SEARCH_ENDPOINT=https://<search-service>.search.windows.net
AZURE_SEARCH_API_KEY=<search-admin-key>
AZURE_SEARCH_INDEX=lexmedical-knowledge

AZURE_OPENAI_ENDPOINT=https://<openai-resource>.openai.azure.com
AZURE_OPENAI_API_KEY=<openai-key>
AZURE_OPENAI_DEPLOYMENT=gpt-4o

UNPAYWALL_EMAIL=research@lexmedical.local
PUBMED_API_KEY=<optional-ncbi-key>
SEMANTIC_SCHOLAR_API_KEY=<optional-semantic-scholar-key>
```

### 4. Install & Run
```
cd api
npm install
npm run dev   # watches with ts-node-dev
```
API is served at `http://localhost:4000`.

### 4.1 Apply Prisma migrations (timeline column)
Before running the API locally (or after pulling new schema changes), make sure the database has the latest migrations applied:

```
cd C:\Office-Apps\LexMedical-App\api
npx prisma migrate dev
```

The current migration only adds the `timeline` JSONB column to the existing `KnowledgeDocument` table (no table recreation). Running the command multiple times is safe; Prisma will skip already-applied migrations.

### 4.2 Deployment on Render
1. צור שירות Web חדש ב-Render ושייך אותו לתיקיית `api`.
2. Build Command: `npm install && npm run build`
3. Start Command: `npm run start`
4. בלשונית **Environment → Environment Variables** העתק את כל הערכים מה-`.env`.
5. הוסף Health Check (`/health`) כדי למנוע sleep ממושך.
6. עדכן ב-frontend את `REACT_APP_API_BASE_URL` לכתובת Render (למשל `https://lexmedical-api.onrender.com/api`).

### 5. HTTP Endpoints
| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/api/ingest/pdf` | Multipart upload: field `file` (PDF), body `docType` (`chapter` \| `precedent`), optional `tags`, `metadata`. Returns indexed metadata + insights. |
| `GET` | `/health` | Health probe. |

### 6. Frontend Integration
Set `REACT_APP_API_BASE_URL=http://localhost:4000/api` (or deploy URL) and update frontend ingestion flow to call the API instead of local processing. Until then, frontend continues לעבוד עם הלוגיקה המקומית.

### 7. Next Steps
- Extend API with retrieval endpoints (`/api/search/query`, `/api/reports/generate`).
- Move summary/report generation to the backend so secrets stay server-side.
- Add CI/CD pipeline deploying frontend + API to Azure Static Web Apps / App Service.

