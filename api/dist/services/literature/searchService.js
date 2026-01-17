"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLiteratureSources = void 0;
const env_1 = require("../env");
const userAgent = 'LexMedical/1.0 (mailto:literature@lexmedical.local)';
const fetchJson = async (url, extraHeaders = {}) => {
    const response = await fetch(url, {
        headers: {
            'User-Agent': userAgent,
            Accept: 'application/json',
            ...extraHeaders,
        },
    });
    if (!response.ok) {
        throw new Error(`request_failed:${response.status}`);
    }
    return response.json();
};
const searchCrossref = async (query) => {
    const url = new URL('https://api.crossref.org/works');
    url.searchParams.set('rows', '5');
    url.searchParams.set('query.bibliographic', query);
    const payload = await fetchJson(url.toString());
    const items = payload?.message?.items ?? [];
    return items
        .map((item) => ({
        doi: item.DOI,
        title: Array.isArray(item.title) ? item.title[0] : item.title,
        authors: (item.author ?? []).map((author) => [author.given, author.family].filter(Boolean).join(' ')).filter(Boolean),
        journal: Array.isArray(item['container-title']) ? item['container-title'][0] : item['container-title'],
        year: item?.issued?.['date-parts']?.[0]?.[0],
        url: item.URL,
        source: 'crossref',
    }))
        .filter((candidate) => candidate.title);
};
const searchPubMed = async (query) => {
    const searchUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    searchUrl.searchParams.set('db', 'pubmed');
    searchUrl.searchParams.set('retmode', 'json');
    searchUrl.searchParams.set('retmax', '5');
    searchUrl.searchParams.set('term', query);
    if (env_1.config.literature.pubmedApiKey) {
        searchUrl.searchParams.set('api_key', env_1.config.literature.pubmedApiKey);
    }
    const searchResult = await fetchJson(searchUrl.toString());
    const ids = searchResult?.esearchresult?.idlist ?? [];
    if (!ids.length)
        return [];
    const summaryUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
    summaryUrl.searchParams.set('db', 'pubmed');
    summaryUrl.searchParams.set('retmode', 'json');
    summaryUrl.searchParams.set('id', ids.join(','));
    if (env_1.config.literature.pubmedApiKey) {
        summaryUrl.searchParams.set('api_key', env_1.config.literature.pubmedApiKey);
    }
    const summaryPayload = await fetchJson(summaryUrl.toString());
    const result = [];
    ids.forEach((id) => {
        const doc = summaryPayload?.result?.[id];
        if (!doc)
            return;
        result.push({
            pmid: id,
            doi: doc.elocationid?.includes('doi') ? doc.elocationid.replace('doi: ', '') : undefined,
            title: doc.title,
            authors: (doc.authors ?? []).map((author) => author.name).filter(Boolean),
            journal: doc.fulljournalname,
            year: doc.pubdate ? Number(doc.pubdate.slice(0, 4)) : undefined,
            url: doc.sortfirstauthor ? `https://pubmed.ncbi.nlm.nih.gov/${id}/` : undefined,
            source: 'pubmed',
        });
    });
    return result.filter((candidate) => candidate.title);
};
const searchSemanticScholar = async (query) => {
    const url = new URL('https://api.semanticscholar.org/graph/v1/paper/search');
    url.searchParams.set('query', query);
    url.searchParams.set('limit', '5');
    url.searchParams.set('fields', 'title,year,venue,authors,url,externalIds');
    const headers = {};
    if (env_1.config.literature.semanticScholarApiKey) {
        headers['x-api-key'] = env_1.config.literature.semanticScholarApiKey;
    }
    const payload = await fetchJson(url.toString(), headers);
    const data = payload?.data ?? [];
    return data
        .map((item) => ({
        doi: item.externalIds?.DOI,
        pmid: item.externalIds?.PMID,
        title: item.title,
        authors: (item.authors ?? []).map((author) => author.name).filter(Boolean),
        journal: item.venue,
        year: item.year,
        url: item.url,
        source: 'semantic_scholar',
    }))
        .filter((candidate) => candidate.title);
};
const searchLiteratureSources = async (queries) => {
    const dedupe = new Map();
    for (const query of queries) {
        try {
            const crossrefResults = await searchCrossref(query);
            crossrefResults.forEach((candidate) => {
                const key = candidate.doi ?? candidate.pmid ?? `${candidate.title}-${candidate.source}`;
                if (!dedupe.has(key))
                    dedupe.set(key, candidate);
            });
        }
        catch (error) {
            console.warn('[literature] crossref search failed', query, error);
        }
        try {
            const pubmedResults = await searchPubMed(query);
            pubmedResults.forEach((candidate) => {
                const key = candidate.doi ?? candidate.pmid ?? `${candidate.title}-${candidate.source}`;
                if (!dedupe.has(key))
                    dedupe.set(key, candidate);
            });
        }
        catch (error) {
            console.warn('[literature] pubmed search failed', query, error);
        }
        try {
            const semanticResults = await searchSemanticScholar(query);
            semanticResults.forEach((candidate) => {
                const key = candidate.doi ?? candidate.pmid ?? `${candidate.title}-${candidate.source}`;
                if (!dedupe.has(key))
                    dedupe.set(key, candidate);
            });
        }
        catch (error) {
            console.warn('[literature] semantic scholar search failed', query, error);
        }
    }
    return Array.from(dedupe.values()).slice(0, 25);
};
exports.searchLiteratureSources = searchLiteratureSources;
