import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_LIBRARY,
  Folder,
  LibraryState,
  MAX_PINS,
  PinSortMode,
  PinnedEntry,
  PinnedSettings,
  Prompt,
} from "@/lib/types";
import { loadLibrary, saveLibrary, subscribeStorage } from "@/lib/storage";
import { newId, nowIso } from "@/lib/messaging";

export class PinLimitError extends Error {
  constructor() {
    super("Pin limit reached");
    this.name = "PinLimitError";
  }
}

interface LibraryContextValue {
  state: LibraryState;
  loading: boolean;
  createPrompt: (
    input: Pick<Prompt, "title" | "body"> &
      Partial<Pick<Prompt, "description" | "tags" | "folderId">>,
  ) => Promise<Prompt>;
  updatePrompt: (
    id: string,
    patch: Partial<Omit<Prompt, "id" | "createdAt">>,
  ) => Promise<void>;
  deletePrompt: (id: string) => Promise<void>;
  touchUsage: (id: string) => Promise<void>;
  createFolder: (name: string) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  pinPrompt: (promptId: string, settings?: PinnedSettings) => Promise<void>;
  unpinPrompt: (promptId: string) => Promise<void>;
  isPinned: (promptId: string) => boolean;
  reorderPins: (orderedIds: string[]) => Promise<void>;
  updatePinSettings: (
    promptId: string,
    settings: PinnedSettings | undefined,
  ) => Promise<void>;
  touchPinUsage: (promptId: string) => Promise<void>;
  setPinSort: (sort: PinSortMode) => Promise<void>;
  setPinsCollapsed: (collapsed: boolean) => Promise<void>;
}

const LibraryContext = createContext<LibraryContextValue | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(DEFAULT_LIBRARY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadLibrary().then((initial) => {
      if (!mounted) return;
      setState(initial);
      setLoading(false);
    });
    const unsub = subscribeStorage((changes) => {
      if (changes.library) setState(changes.library);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const persist = useCallback(async (next: LibraryState) => {
    setState(next);
    await saveLibrary(next);
  }, []);

  const createPrompt = useCallback<LibraryContextValue["createPrompt"]>(
    async (input) => {
      const now = nowIso();
      const prompt: Prompt = {
        id: newId(),
        title: input.title.slice(0, 100),
        body: input.body.slice(0, 10_000),
        description: input.description?.slice(0, 300),
        tags: input.tags ?? [],
        folderId: input.folderId ?? null,
        createdAt: now,
        updatedAt: now,
        usageCount: 0,
      };
      const next: LibraryState = {
        ...state,
        prompts: [prompt, ...state.prompts],
      };
      await persist(next);
      return prompt;
    },
    [state, persist],
  );

  const updatePrompt = useCallback<LibraryContextValue["updatePrompt"]>(
    async (id, patch) => {
      const next: LibraryState = {
        ...state,
        prompts: state.prompts.map((p) =>
          p.id === id
            ? {
                ...p,
                ...patch,
                title: (patch.title ?? p.title).slice(0, 100),
                body: (patch.body ?? p.body).slice(0, 10_000),
                description: patch.description
                  ? patch.description.slice(0, 300)
                  : patch.description === null
                    ? undefined
                    : p.description,
                updatedAt: nowIso(),
              }
            : p,
        ),
      };
      await persist(next);
    },
    [state, persist],
  );

  const deletePrompt = useCallback(
    async (id: string) => {
      const next: LibraryState = {
        ...state,
        prompts: state.prompts.filter((p) => p.id !== id),
        pins: {
          ...state.pins,
          entries: state.pins.entries.filter((entry) => entry.promptId !== id),
        },
      };
      await persist(next);
    },
    [state, persist],
  );

  const touchUsage = useCallback(
    async (id: string) => {
      const next: LibraryState = {
        ...state,
        prompts: state.prompts.map((p) =>
          p.id === id
            ? {
                ...p,
                usageCount: p.usageCount + 1,
                updatedAt: nowIso(),
              }
            : p,
        ),
      };
      await persist(next);
    },
    [state, persist],
  );

  const createFolder = useCallback(
    async (name: string) => {
      const trimmed = name.trim().slice(0, 60);
      if (!trimmed) throw new Error("Folder name required");
      const now = nowIso();
      const folder: Folder = {
        id: newId(),
        name: trimmed,
        createdAt: now,
        updatedAt: now,
      };
      const next: LibraryState = {
        ...state,
        folders: [...state.folders, folder],
      };
      await persist(next);
      return folder;
    },
    [state, persist],
  );

  const renameFolder = useCallback(
    async (id: string, name: string) => {
      const trimmed = name.trim().slice(0, 60);
      if (!trimmed) return;
      const next: LibraryState = {
        ...state,
        folders: state.folders.map((f) =>
          f.id === id ? { ...f, name: trimmed, updatedAt: nowIso() } : f,
        ),
      };
      await persist(next);
    },
    [state, persist],
  );

  const deleteFolder = useCallback(
    async (id: string) => {
      const next: LibraryState = {
        ...state,
        folders: state.folders.filter((f) => f.id !== id),
        prompts: state.prompts.map((p) =>
          p.folderId === id ? { ...p, folderId: null } : p,
        ),
      };
      await persist(next);
    },
    [state, persist],
  );

  const pinPrompt = useCallback<LibraryContextValue["pinPrompt"]>(
    async (promptId, settings) => {
      if (!state.prompts.some((p) => p.id === promptId)) return;
      if (state.pins.entries.some((entry) => entry.promptId === promptId)) return;
      if (state.pins.entries.length >= MAX_PINS) throw new PinLimitError();

      const nextOrder =
        state.pins.entries.reduce(
          (max, entry) => Math.max(max, entry.displayOrder),
          -1,
        ) + 1;
      const entry: PinnedEntry = {
        promptId,
        pinnedAt: nowIso(),
        displayOrder: nextOrder,
        pinnedSettings: sanitizePinnedSettings(settings),
      };
      const next: LibraryState = {
        ...state,
        pins: { ...state.pins, entries: [...state.pins.entries, entry] },
      };
      await persist(next);
    },
    [state, persist],
  );

  const unpinPrompt = useCallback<LibraryContextValue["unpinPrompt"]>(
    async (promptId) => {
      if (!state.pins.entries.some((entry) => entry.promptId === promptId)) {
        return;
      }
      const next: LibraryState = {
        ...state,
        pins: {
          ...state.pins,
          entries: state.pins.entries.filter(
            (entry) => entry.promptId !== promptId,
          ),
        },
      };
      await persist(next);
    },
    [state, persist],
  );

  const isPinned = useCallback(
    (promptId: string) =>
      state.pins.entries.some((entry) => entry.promptId === promptId),
    [state.pins.entries],
  );

  const reorderPins = useCallback<LibraryContextValue["reorderPins"]>(
    async (orderedIds) => {
      const map = new Map(
        state.pins.entries.map((entry) => [entry.promptId, entry]),
      );
      const nextEntries: PinnedEntry[] = [];
      orderedIds.forEach((id, index) => {
        const entry = map.get(id);
        if (entry) {
          nextEntries.push({ ...entry, displayOrder: index });
          map.delete(id);
        }
      });
      // Preserve any entries not passed in by appending them at the end.
      let tail = nextEntries.length;
      for (const leftover of map.values()) {
        nextEntries.push({ ...leftover, displayOrder: tail++ });
      }
      const next: LibraryState = {
        ...state,
        pins: { ...state.pins, entries: nextEntries, sort: "manual" },
      };
      await persist(next);
    },
    [state, persist],
  );

  const updatePinSettings = useCallback<LibraryContextValue["updatePinSettings"]>(
    async (promptId, settings) => {
      const sanitized = sanitizePinnedSettings(settings);
      const next: LibraryState = {
        ...state,
        pins: {
          ...state.pins,
          entries: state.pins.entries.map((entry) =>
            entry.promptId === promptId
              ? { ...entry, pinnedSettings: sanitized }
              : entry,
          ),
        },
      };
      await persist(next);
    },
    [state, persist],
  );

  const touchPinUsage = useCallback<LibraryContextValue["touchPinUsage"]>(
    async (promptId) => {
      if (!state.pins.entries.some((entry) => entry.promptId === promptId)) {
        return;
      }
      const now = nowIso();
      const next: LibraryState = {
        ...state,
        pins: {
          ...state.pins,
          entries: state.pins.entries.map((entry) =>
            entry.promptId === promptId ? { ...entry, lastUsedAt: now } : entry,
          ),
        },
      };
      await persist(next);
    },
    [state, persist],
  );

  const setPinSort = useCallback<LibraryContextValue["setPinSort"]>(
    async (sort) => {
      if (state.pins.sort === sort) return;
      const next: LibraryState = {
        ...state,
        pins: { ...state.pins, sort },
      };
      await persist(next);
    },
    [state, persist],
  );

  const setPinsCollapsed = useCallback<LibraryContextValue["setPinsCollapsed"]>(
    async (collapsed) => {
      if (state.pins.collapsed === collapsed) return;
      const next: LibraryState = {
        ...state,
        pins: { ...state.pins, collapsed },
      };
      await persist(next);
    },
    [state, persist],
  );

  const value = useMemo<LibraryContextValue>(
    () => ({
      state,
      loading,
      createPrompt,
      updatePrompt,
      deletePrompt,
      touchUsage,
      createFolder,
      renameFolder,
      deleteFolder,
      pinPrompt,
      unpinPrompt,
      isPinned,
      reorderPins,
      updatePinSettings,
      touchPinUsage,
      setPinSort,
      setPinsCollapsed,
    }),
    [
      state,
      loading,
      createPrompt,
      updatePrompt,
      deletePrompt,
      touchUsage,
      createFolder,
      renameFolder,
      deleteFolder,
      pinPrompt,
      unpinPrompt,
      isPinned,
      reorderPins,
      updatePinSettings,
      touchPinUsage,
      setPinSort,
      setPinsCollapsed,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error("useLibrary must be used within LibraryProvider");
  return ctx;
}

/**
 * Strip out no-op overrides so that "no customisation" is stored as
 * `undefined` rather than an empty object. Keeps the chrome.storage payload
 * small and makes the "has overrides" check on the UI trivially cheap.
 */
function sanitizePinnedSettings(
  input: PinnedSettings | undefined,
): PinnedSettings | undefined {
  if (!input) return undefined;
  const out: PinnedSettings = {};
  if (input.modelOverride && input.modelOverride.trim()) {
    out.modelOverride = input.modelOverride.trim().slice(0, 80);
  }
  if (
    typeof input.temperature === "number" &&
    Number.isFinite(input.temperature)
  ) {
    out.temperature = Math.min(Math.max(input.temperature, 0), 2);
  }
  if (input.systemPromptOverride && input.systemPromptOverride.trim()) {
    out.systemPromptOverride = input.systemPromptOverride.trim().slice(0, 2000);
  }
  if (input.targetService && input.targetService !== "auto") {
    out.targetService = input.targetService;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function hasPinOverrides(settings: PinnedSettings | undefined): boolean {
  if (!settings) return false;
  return Boolean(
    settings.modelOverride ||
      typeof settings.temperature === "number" ||
      settings.systemPromptOverride ||
      (settings.targetService && settings.targetService !== "auto"),
  );
}
