import pdf from 'pdf-parse';

export const extractTextLocally = async (buffer: Buffer): Promise<string> => {
  try {
    const data = await pdf(buffer);
    if (!data.text) return '';
    return data.text.replace(/\s+/g, ' ').trim();
  } catch (error) {
    console.warn('[localPdfParser] failed to parse PDF locally:', error);
    return '';
  }
};

