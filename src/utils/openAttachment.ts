import { authorizedFetch } from '../services/api';

const parseFilenameFromContentDisposition = (value: string | null): string | null => {
  if (!value) return null;
  // Prefer RFC5987 filename*=UTF-8''...
  const utf8 = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      return utf8[1].trim();
    }
  }
  const simple = value.match(/filename\s*=\s*"?([^"]+)"?/i);
  return simple?.[1]?.trim() ?? null;
};

export const openAttachment = async (url: string, fallbackName?: string): Promise<void> => {
  const res = await authorizedFetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `attachment_fetch_failed_${res.status}`);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const disposition = res.headers.get('content-disposition');
  const filename = parseFilenameFromContentDisposition(disposition) ?? fallbackName ?? 'attachment';

  // Prefer download to avoid popup blockers and binary rendering issues.
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  a.rel = 'noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Release the URL shortly after.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
};


