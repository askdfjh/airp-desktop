import { create } from "zustand";
import type { CharacterCard, Character, CharacterArc, SessionCharacter } from "@/types";
import {
  loadCharacterCards,
  insertCharacterCard,
  updateCharacterCard,
  deleteCharacterCard,
  initBuiltinCharacterCards,
  loadCharacters,
  insertCharacter,
  updateCharacter,
  deleteCharacter,
  initBuiltinCharacters,
  restoreDefaultCharacters,
  loadCharacterArcs,
  insertCharacterArc,
  clearCharacterArcs,
  getArcTurnCount,
  loadSessionCharacters,
  insertSessionCharacter,
  deleteSessionCharacter,
} from "@/lib/db";

interface CharacterState {
  cards: CharacterCard[];
  characters: Character[];
  arcs: CharacterArc[];
  sessionCharacters: SessionCharacter[];
  loaded: boolean;

  loadFromDb: () => Promise<void>;
  addCard: (c: Omit<CharacterCard, "createdAt" | "updatedAt">) => Promise<void>;
  updateCard: (id: string, fields: { name?: string; description?: string; systemPrompt?: string; emoji?: string; tags?: string[] }) => Promise<void>;
  removeCard: (id: string) => Promise<void>;

  loadCharactersFromDb: () => Promise<void>;
  restoreDefaultCharacters: () => Promise<void>;
  addCharacter: (c: Omit<Character, "createdAt" | "updatedAt">) => Promise<void>;
  updateCharacter: (id: string, fields: Partial<Omit<Character, "id" | "createdAt" | "updatedAt">>) => Promise<void>;
  removeCharacter: (id: string) => Promise<void>;

  loadArcs: (characterId: string, worldContext?: string) => Promise<void>;
  addArc: (a: Omit<CharacterArc, "createdAt">) => Promise<void>;
  clearWorldArcs: (characterId: string, worldContext: string) => Promise<void>;
  getTurnCount: (characterId: string, worldContext: string) => Promise<number>;

  loadSessionCharacters: (sessionId: string) => Promise<void>;
  bindCharacterToSession: (sessionId: string, characterId: string, worldContext: string) => Promise<void>;
  unbindCharacterFromSession: (id: string) => Promise<void>;
  getSessionCharacters: (sessionId: string) => SessionCharacter[];
}

export const useCharacterStore = create<CharacterState>((set, get) => ({
  cards: [],
  characters: [],
  arcs: [],
  sessionCharacters: [],
  loaded: false,

  loadFromDb: async () => {
    try {
      await initBuiltinCharacterCards();
      const cards = await loadCharacterCards();
      set({ cards });
    } catch (e) {
      console.error("[db] loadCharacterCards failed:", e);
    }
  },

  addCard: async (c) => {
    const now = Date.now();
    const newC: CharacterCard = { ...c, createdAt: now, updatedAt: now };
    await insertCharacterCard(newC);
    set((st) => ({ cards: [newC, ...st.cards] }));
  },

  updateCard: async (id, fields) => {
    const now = Date.now();
    await updateCharacterCard(id, { ...fields, updatedAt: now });
    set((st) => ({
      cards: st.cards.map((c) =>
        c.id === id ? { ...c, ...fields, updatedAt: now } : c
      ),
    }));
  },

  removeCard: async (id) => {
    await deleteCharacterCard(id);
    set((st) => ({ cards: st.cards.filter((c) => c.id !== id) }));
  },

  loadCharactersFromDb: async () => {
    try {
      await initBuiltinCharacters();
      const characters = await loadCharacters();
      set({ characters, loaded: true });
    } catch (e) {
      console.error("[db] loadCharacters failed:", e);
      set({ loaded: true });
    }
  },

  restoreDefaultCharacters: async () => {
    await restoreDefaultCharacters();
    const characters = await loadCharacters();
    set({ characters });
  },

  addCharacter: async (c) => {
    const now = Date.now();
    const newC: Character = { ...c, createdAt: now, updatedAt: now };
    await insertCharacter(newC);
    set((st) => ({ characters: [newC, ...st.characters] }));
  },

  updateCharacter: async (id, fields) => {
    const now = Date.now();
    await updateCharacter(id, { ...fields, updatedAt: now });
    set((st) => ({
      characters: st.characters.map((c) =>
        c.id === id ? { ...c, ...fields, updatedAt: now } : c
      ),
    }));
  },

  removeCharacter: async (id) => {
    await deleteCharacter(id);
    set((st) => ({
      characters: st.characters.filter((c) => c.id !== id),
      arcs: st.arcs.filter((a) => a.characterId !== id),
    }));
  },

  loadArcs: async (characterId, worldContext) => {
    try {
      const arcs = await loadCharacterArcs(characterId, worldContext);
      set({ arcs });
    } catch (e) {
      console.error("[db] loadCharacterArcs failed:", e);
    }
  },

  addArc: async (a) => {
    const now = Date.now();
    const newArc: CharacterArc = { ...a, createdAt: now };
    await insertCharacterArc(newArc);
    set((st) => ({ arcs: [...st.arcs, newArc] }));
  },

  clearWorldArcs: async (characterId, worldContext) => {
    await clearCharacterArcs(characterId, worldContext);
    set((st) => ({
      arcs: st.arcs.filter(
        (a) => !(a.characterId === characterId && a.worldContext === worldContext)
      ),
    }));
  },

  getTurnCount: async (characterId, worldContext) => {
    return await getArcTurnCount(characterId, worldContext);
  },

  loadSessionCharacters: async (sessionId) => {
    try {
      const sessionCharacters = await loadSessionCharacters(sessionId);
      set({ sessionCharacters });
    } catch (e) {
      console.error("[db] loadSessionCharacters failed:", e);
    }
  },

  bindCharacterToSession: async (sessionId, characterId, worldContext) => {
    const now = Date.now();
    const sc: SessionCharacter = {
      id: crypto.randomUUID(),
      sessionId,
      characterId,
      worldContext,
      arcClearedAt: null,
      createdAt: now,
    };
    await insertSessionCharacter(sc);
    set((st) => ({ sessionCharacters: [...st.sessionCharacters, sc] }));
  },

  unbindCharacterFromSession: async (id) => {
    await deleteSessionCharacter(id);
    set((st) => ({
      sessionCharacters: st.sessionCharacters.filter((s) => s.id !== id),
    }));
  },

  getSessionCharacters: (sessionId) => {
    return get().sessionCharacters.filter((s) => s.sessionId === sessionId);
  },
}));

