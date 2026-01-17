const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'without', 'case', 'study', 'report', 'patient', 'patients']);

const tokenize = (value?: string): string[] => {
  if (!value) return [];
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
};

interface ClaimLite {
  id?: string;
  type?: string;
  value?: string;
}

export const linkClaimsToText = (claims: ClaimLite[], text?: string): string[] => {
  if (!text) return [];
  const targetTokens = new Set(tokenize(text));
  if (!targetTokens.size) return [];

  return claims
    .map((claim) => {
      const claimTokens = tokenize(`${claim.type ?? ''} ${claim.value ?? ''}`);
      const overlap = claimTokens.filter((token) => targetTokens.has(token));
      return { id: claim.id, score: overlap.length };
    })
    .filter((entry) => entry.id && entry.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.id!) as string[];
};

