# Blob Healthcheck (Temporary)

This temporary check verifies that the API can upload a small text blob to Azure Blob Storage.

## 1) Required ENV

Set these on Render API service:

- `AZURE_STORAGE_CONNECTION_STRING` = your storage connection string
- `AZURE_STORAGE_CONTAINER` = `book-chapters`
- `ADMIN_TEST_TOKEN` = long random token (used by `X-Admin-Token` header)

## 2) Endpoint

- Method: `GET`
- URL: `/api/admin/blob-healthcheck`
- Protection: header `X-Admin-Token: <ADMIN_TEST_TOKEN>`

The endpoint uploads:

- Blob name: `healthcheck/<timestamp>.txt`
- Content: `ok <timestamp>`

Response shape:

```json
{
  "ok": true,
  "container": "book-chapters",
  "blobName": "healthcheck/1741500000000.txt",
  "etag": "\"0x8....\""
}
```

## 3) curl examples

Local `.env.local` suggestion (do not commit):

```env
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_STORAGE_CONTAINER=book-chapters
ADMIN_TEST_TOKEN=...
```

Local:

```bash
curl -i -H "X-Admin-Token: YOUR_ADMIN_TEST_TOKEN" http://localhost:4000/api/admin/blob-healthcheck
```

Render:

```bash
curl -i -H "X-Admin-Token: YOUR_ADMIN_TEST_TOKEN" https://<your-api-domain>/api/admin/blob-healthcheck
```

## 4) Verify in Azure Portal

1. Open Storage Account `lpaitranslator`
2. Open **Containers**
3. Open container **book-chapters**
4. Open folder/prefix **healthcheck/**
5. Confirm a new `<timestamp>.txt` file exists

## 5) Disable/remove after validation

After successful validation:

1. Remove route `GET /api/admin/blob-healthcheck` from `api/src/routes/admin.ts`
2. (Optional) delete `api/src/services/blobStorage.ts` if not needed elsewhere
3. Remove `ADMIN_TEST_TOKEN` from Render ENV
4. Redeploy

This endpoint is intended for short-term diagnostics only.
