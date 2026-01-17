import { BookChapter, GlobalPrecedent, KnowledgeBase } from '../types';

const inMemoryStore: KnowledgeBase = {
  book: [],
  precedents: [],
  lastUpdated: new Date().toISOString(),
};

const cloneStore = (): KnowledgeBase => ({
  book: [...inMemoryStore.book],
  precedents: [...inMemoryStore.precedents],
  lastUpdated: inMemoryStore.lastUpdated,
});

export const getKnowledgeBase = (): KnowledgeBase => cloneStore();

export const saveBookChapter = (chapter: BookChapter): void => {
  const existingIndex = inMemoryStore.book.findIndex((item) => item.id === chapter.id);
  if (existingIndex >= 0) {
    inMemoryStore.book[existingIndex] = chapter;
  } else {
    inMemoryStore.book.push(chapter);
  }
  inMemoryStore.lastUpdated = new Date().toISOString();
};

export const saveGlobalPrecedent = (precedent: GlobalPrecedent): void => {
  const existingIndex = inMemoryStore.precedents.findIndex((item) => item.id === precedent.id);
  if (existingIndex >= 0) {
    inMemoryStore.precedents[existingIndex] = precedent;
  } else {
    inMemoryStore.precedents.push(precedent);
  }
  inMemoryStore.lastUpdated = new Date().toISOString();
};

