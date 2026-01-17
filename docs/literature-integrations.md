# Literature Integrations (Phase 8)

## ChatGPT Scholar Review

- During Phase 8 we evaluated “ChatGPT Scholar” as a potential literature source.
- OpenAI does **not** publish an official ChatGPT Scholar API or stable integration policy. The product is only exposed through the ChatGPT UI and Terms of Use prohibit automated scraping.
- Because no compliant API exists, LexMedical **does not integrate** with ChatGPT Scholar and will not attempt to scrape or “spoof” the site.
- Instead we added an approved scholarly data source (Semantic Scholar Graph API) in addition to Crossref + PubMed.
- Production searches rely on PubMed, Crossref, Unpaywall (OA validation), and optionally Semantic Scholar — ChatGPT Scholar remains disconnected due to the missing official API.

## Current Sources

| Source | Purpose | Auth |
| --- | --- | --- |
| Crossref | DOI-first discovery | none |
| PubMed E-utilities | Biomedical indexing | `PUBMED_API_KEY` (optional) |
| Semantic Scholar Graph | Wider coverage when ChatGPT Scholar unavailable | `SEMANTIC_SCHOLAR_API_KEY` (optional) |
| Unpaywall | OA status | `UNPAYWALL_EMAIL` |
| Europe PMC / OA PDF | handled via Unpaywall + PMC IDs |

## Environment Variables

```
UNPAYWALL_EMAIL=<contact email>
PUBMED_API_KEY=<optional NCBI key>
SEMANTIC_SCHOLAR_API_KEY=<optional x-api-key>
```

- All variables are optional. When not provided the system automatically falls back to unauthenticated access (rate-limited).
- If no key is configured the Semantic Scholar search is still attempted anonymously; errors are logged and other sources continue to function.

## Fallback Behaviour

1. Crossref + PubMed are always queried.
2. Semantic Scholar is queried when available; failures do not interrupt other pipelines.
3. If every external source fails, the API responds gracefully with an empty resource list and the UI prompts the user to retry later.

