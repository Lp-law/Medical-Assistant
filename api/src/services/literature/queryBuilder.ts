const STOP_WORDS = new Set([
  'the',
  'and',
  'with',
  'without',
  'for',
  'from',
  'symptom',
  'patient',
  'patients',
  'case',
  'cases',
  'study',
  'report',
  'medical',
  'clinical',
  'evidence',
  'analysis',
  'therapy',
  'follow',
  'treatment',
  'disease',
  'condition',
]);

const MAX_QUERIES = 8;

const normalizeText = (value: string): string => {
  return value
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
};

const cleanToken = (token: string): string | null => {
  if (!token) return null;
  if (!/^[a-z]+$/.test(token)) return null;
  if (/^\d+$/.test(token)) return null;
  if (token.length <= 2) return null;
  if (STOP_WORDS.has(token)) return null;
  if (/\d{3,}/.test(token)) return null;
  return token;
};

const buildPhrase = (tokens: string[]): string | null => {
  const filtered = tokens.map((token) => cleanToken(token)).filter((token): token is string => Boolean(token));
  if (filtered.length === 0) return null;
  return filtered.slice(0, 6).join(' ');
};

const evidenceWeight: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const scoreClaim = (claim: { type?: string; evidenceQuality?: string }): number => {
  const base = evidenceWeight[claim.evidenceQuality ?? 'low'] ?? 1;
  const type = normalizeText(claim.type ?? '');
  let bonus = 0;
  if (/diagnos|אבח|finding/.test(type)) bonus += 1.5;
  if (/procedure|surgery|operation|imaging|test|biopsy/.test(type)) bonus += 1;
  return base + bonus;
};

const buildClaimQuery = (claim: { type?: string; value?: string }): string | null => {
  const normalizedType = normalizeText(claim.type ?? '');
  const normalizedValue = normalizeText(claim.value ?? '');
  const combined = `${normalizedType} ${normalizedValue}`.trim();
  if (!combined) return null;
  const phrase = buildPhrase(combined.split(' '));
  if (!phrase) return null;
  const typeTokens = buildPhrase(normalizedType.split(' '));
  return typeTokens ? `${typeTokens} ${phrase}`.trim() : phrase;
};

const timelinePriority = (type?: string): number => {
  const normalized = normalizeText(type ?? '');
  if (/surgery|operation|procedure/.test(normalized)) return 3;
  if (/hospital|admission|discharge/.test(normalized)) return 2;
  if (/follow|clinic|review/.test(normalized)) return 1;
  return 0;
};

export interface QueryBuilderInput {
  claims: Array<{ id?: string; type?: string; value?: string; evidenceQuality?: string }>;
  timeline: Array<{ type?: string; description?: string }>;
}

export const buildLiteratureQueries = ({ claims = [], timeline = [] }: QueryBuilderInput): string[] => {
  const queries = new Set<string>();

  const prioritizedClaims = [...claims]
    .filter((claim) => (claim.type ?? claim.value ?? '').length > 0)
    .sort((a, b) => scoreClaim(b) - scoreClaim(a));

  prioritizedClaims.forEach((claim) => {
    if (queries.size >= MAX_QUERIES) return;
    const query = buildClaimQuery(claim);
    if (query) {
      queries.add(query);
    }
  });

  const prioritizedTimeline = [...timeline]
    .filter((event) => timelinePriority(event.type) > 0)
    .sort((a, b) => timelinePriority(b.type) - timelinePriority(a.type));

  prioritizedTimeline.forEach((event) => {
    if (queries.size >= MAX_QUERIES) return;
    const base = normalizeText(`${event.type ?? ''} ${event.description ?? ''}`);
    const phrase = buildPhrase(base.split(' '));
    if (phrase) {
      queries.add(phrase);
    }
  });

  const fallback = ['clinical malpractice risk', 'diagnostic failure review'];
  fallback.forEach((term) => {
    if (queries.size < 3) {
      queries.add(term);
    }
  });

  return Array.from(queries).slice(0, MAX_QUERIES);
};

