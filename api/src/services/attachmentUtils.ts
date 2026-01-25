import path from 'path';

/**
 * Normalize attachment filename - ensure it has a valid name and extension
 */
export const normalizeAttachmentFilename = (filename?: string, contentType?: string): string => {
  if (!filename || typeof filename !== 'string') {
    // Generate a default filename based on content type
    if (contentType) {
      if (contentType.includes('pdf')) return 'attachment.pdf';
      if (contentType.includes('wordprocessingml') || contentType.includes('msword')) {
        return 'attachment.docx';
      }
    }
    return 'attachment';
  }

  // Remove path separators and control characters
  let normalized = filename
    .replace(/[\\\/]+/g, '_')
    .replace(/[\x00-\x1F\x7F]+/g, '_')
    .trim();

  // Ensure it has an extension
  const ext = path.extname(normalized).toLowerCase();
  if (!ext) {
    // Try to infer from content type
    if (contentType) {
      if (contentType.includes('pdf')) normalized += '.pdf';
      else if (contentType.includes('wordprocessingml')) normalized += '.docx';
      else if (contentType.includes('msword')) normalized += '.doc';
    } else {
      normalized += '.bin';
    }
  }

  // Limit length
  if (normalized.length > 200) {
    const ext2 = path.extname(normalized);
    const nameWithoutExt = normalized.slice(0, 200 - ext2.length);
    normalized = nameWithoutExt + ext2;
  }

  return normalized || 'attachment';
};
