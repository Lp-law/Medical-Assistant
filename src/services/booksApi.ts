import { API_BASE_URL, authFetch, getAuthToken } from './api';

export type BookChapter = {
  id: string;
  title: string;
  bookChapter: string;
};

export type BookChaptersResponse = {
  bookName: string;
  chapters: BookChapter[];
};

export const fetchBookChapters = async (): Promise<BookChaptersResponse> => {
  const res = await authFetch('/books/chapters');
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(res.status === 404 ? 'לא נמצאו פרקים' : text || 'שגיאה בטעינת הפרקים');
  }
  return res.json();
};

/** Opens the chapter PDF in a new tab (fetches with auth and opens as blob URL). */
export const openChapterPdf = async (chapterId: string, title: string): Promise<void> => {
  const base = API_BASE_URL.replace(/\/$/, '');
  const url = `${base}/books/chapters/${encodeURIComponent(chapterId)}/file`;
  const headers: HeadersInit = {};
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { credentials: 'include', headers });
  if (!res.ok) {
    if (res.status === 404) throw new Error('קובץ הפרק לא נמצא בשרת.');
    throw new Error('לא ניתן לפתוח את הקובץ.');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const w = window.open(blobUrl, '_blank', 'noopener');
  if (w) {
    w.document.title = title;
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  } else {
    URL.revokeObjectURL(blobUrl);
    throw new Error('נא לאפשר חלונות קופצים לפתיחת הפרק.');
  }
};
