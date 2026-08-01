import { create } from "zustand";
import type { WorldBook, WorldBookEntry } from "@/types";
import {
  loadWorldBooks,
  insertWorldBook,
  updateWorldBook,
  deleteWorldBook,
  loadEntriesByBook,
  insertWorldBookEntry,
  updateWorldBookEntry,
  deleteWorldBookEntry,
  loadActiveWorldBook,
  deactivateAllWorldBooks,
  initBuiltinWorldBooks,
  loadWorldBookTrash,
  restoreFromTrash,
  deleteFromTrash,
  cleanExpiredTrash,
} from "@/lib/db";

interface WorldState {
  books: WorldBook[];
  loaded: boolean;
  activeBook: WorldBook | null;
  selectedBookId: string | null;
  trashBooks: { id: string; data: string; deletedAt: number; expiredAt: number }[];

  loadFromDb: () => Promise<void>;
  selectBook: (id: string | null) => void;
  
  addBook: (book: Omit<WorldBook, "id" | "entries" | "createdAt" | "updatedAt">) => Promise<void>;
  updateBook: (id: string, fields: Partial<Pick<WorldBook, "name" | "theme" | "description" | "tags" | "isActive" | "isBuiltin" | "violationWords">>) => Promise<void>;
  removeBook: (id: string) => Promise<void>;
  setActiveBook: (id: string) => Promise<void>;
  deactivateAllBooks: () => Promise<void>;

  loadTrashFromDb: () => Promise<void>;
  restoreBookFromTrash: (id: string) => Promise<void>;
  purgeBookFromTrash: (id: string) => Promise<void>;
  clearExpiredTrash: () => Promise<void>;
  
  addEntry: (bookId: string, entry: Omit<WorldBookEntry, "uid" | "createdAt" | "updatedAt">) => Promise<void>;
  updateEntry: (bookId: string, entryId: string, fields: Partial<Omit<WorldBookEntry, "uid" | "createdAt" | "updatedAt">>) => Promise<void>;
  removeEntry: (bookId: string, entryId: string) => Promise<void>;
}

export const useWorldStore = create<WorldState>((set, get) => ({
  books: [],
  loaded: false,
  activeBook: null,
  selectedBookId: null,
  trashBooks: [],

  loadFromDb: async () => {
    try {
      await initBuiltinWorldBooks();
      const books = await loadWorldBooks(true);
      const activeBook = await loadActiveWorldBook();
      // 没有主动选择世界时保持空状态，不自动默认第一本
      set({ books, activeBook, loaded: true });
    } catch (e) {
      console.error("[db] loadWorldBooks failed:", e);
      set({ loaded: true });
    }
  },

  selectBook: (id) => {
    set({ selectedBookId: id });
  },

  addBook: async (bookData) => {
    const now = Date.now();
    const newBook: WorldBook = {
      ...bookData,
      id: crypto.randomUUID(),
      entries: [],
      createdAt: now,
      updatedAt: now,
    };
    await insertWorldBook(newBook);
    set((st) => ({ 
      books: [newBook, ...st.books],
      selectedBookId: newBook.id 
    }));
  },

  updateBook: async (id, fields) => {
    const now = Date.now();
    await updateWorldBook(id, { ...fields, updatedAt: now });
    set((st) => ({
      books: st.books.map((b) =>
        b.id === id ? { ...b, ...fields, updatedAt: now } : b
      ),
      activeBook: st.activeBook?.id === id ? { ...st.activeBook, ...fields, updatedAt: now } : st.activeBook,
    }));
  },

  removeBook: async (id) => {
    await deleteWorldBook(id);
    set((st) => {
      const books = st.books.filter((b) => b.id !== id);
      const activeBook = st.activeBook?.id === id ? null : st.activeBook;
      const selectedBookId = st.selectedBookId === id ? null : st.selectedBookId;
      return { books, activeBook, selectedBookId };
    });
  },

  loadTrashFromDb: async () => {
    try {
      const trashBooks = await loadWorldBookTrash();
      set({ trashBooks });
    } catch (e) {
      console.error("[db] loadWorldBookTrash failed:", e);
    }
  },

  restoreBookFromTrash: async (id) => {
    await restoreFromTrash(id);
    const trashBooks = await loadWorldBookTrash();
    const books = await loadWorldBooks(true);
    set({ trashBooks, books });
  },

  purgeBookFromTrash: async (id) => {
    await deleteFromTrash(id);
    set((st) => ({ trashBooks: st.trashBooks.filter((b) => b.id !== id) }));
  },

  clearExpiredTrash: async () => {
    try {
      await cleanExpiredTrash();
      const trashBooks = await loadWorldBookTrash();
      set({ trashBooks });
    } catch (e) {
      console.error("[db] cleanExpiredTrash failed:", e);
    }
  },

  setActiveBook: async (id) => {
    const now = Date.now();
    await deactivateAllWorldBooks();
    await updateWorldBook(id, { isActive: true, updatedAt: now });
    set((st) => {
      const books = st.books.map((b) => ({
        ...b,
        isActive: b.id === id,
        updatedAt: b.id === id ? now : b.updatedAt,
      }));
      const activeBook = books.find((b) => b.id === id) || null;
      return { books, activeBook };
    });
  },

  deactivateAllBooks: async () => {
    const now = Date.now();
    await deactivateAllWorldBooks();
    set((st) => ({
      books: st.books.map((b) => ({ ...b, isActive: false, updatedAt: now })),
      activeBook: null,
    }));
  },

  addEntry: async (bookId, entryData) => {
    const now = Date.now();
    const newEntry: WorldBookEntry = {
      ...entryData,
      id: crypto.randomUUID(),
      uid: Date.now(),
      createdAt: now,
      updatedAt: now,
    };
    await insertWorldBookEntry(bookId, newEntry);
    set((st) => ({
      books: st.books.map((b) =>
        b.id === bookId ? { ...b, entries: [...b.entries, newEntry] } : b
      ),
      activeBook: st.activeBook?.id === bookId ? { ...st.activeBook, entries: [...st.activeBook.entries, newEntry] } : st.activeBook,
    }));
  },

  updateEntry: async (bookId, entryId, fields) => {
    const now = Date.now();
    await updateWorldBookEntry(entryId, { ...fields });
    set((st) => {
      const updateEntries = (entries: WorldBookEntry[]) =>
        entries.map((e) => e.id === entryId ? { ...e, ...fields, updatedAt: now } : e);
      
      return {
        books: st.books.map((b) =>
          b.id === bookId ? { ...b, entries: updateEntries(b.entries) } : b
        ),
        activeBook: st.activeBook?.id === bookId ? { ...st.activeBook, entries: updateEntries(st.activeBook.entries) } : st.activeBook,
      };
    });
  },

  removeEntry: async (bookId, entryId) => {
    await deleteWorldBookEntry(entryId);
    set((st) => {
      const filterEntries = (entries: WorldBookEntry[]) =>
        entries.filter((e) => e.id !== entryId);
        
      return {
        books: st.books.map((b) =>
          b.id === bookId ? { ...b, entries: filterEntries(b.entries) } : b
        ),
        activeBook: st.activeBook?.id === bookId ? { ...st.activeBook, entries: filterEntries(st.activeBook.entries) } : st.activeBook,
      };
    });
  },
}));