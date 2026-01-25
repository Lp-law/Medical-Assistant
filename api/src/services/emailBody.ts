/**
 * Extract plain text body from parsed email
 */
export const getEmailBodyText = (parsed: any): string => {
  // Prefer text over HTML
  if (parsed?.text) {
    return typeof parsed.text === 'string' ? parsed.text : '';
  }
  if (parsed?.html) {
    // Basic HTML stripping - remove tags, decode entities
    const html = typeof parsed.html === 'string' ? parsed.html : '';
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '') // Remove scripts
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') // Remove styles
      .replace(/<[^>]+>/g, ' ') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
  return '';
};
