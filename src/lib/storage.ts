import {
  DEFAULT_LIBRARY,
  DEFAULT_PINS,
  DEFAULT_SETTINGS,
  LibraryState,
  PinnedEntry,
  PinsState,
  Settings,
  ProviderId,
} from "./types";
import { deobfuscate, obfuscate } from "./crypto";

const KEY_SETTINGS = "promptup:settings";
const KEY_LIBRARY = "promptup:library";

function getStorage(): chrome.storage.LocalStorageArea {
  if (typeof chrome === "undefined" || !chrome.storage) {
    throw new Error("chrome.storage is not available in this context.");
  }
  return chrome.storage.local;
}

async function readRaw<T>(key: string, fallback: T): Promise<T> {
  const storage = getStorage();
  const result = await storage.get(key);
  const value = (result as Record<string, unknown>)[key];
  if (value === undefined || value === null) return fallback;
  return value as T;
}

async function writeRaw(key: string, value: unknown): Promise<void> {
  const storage = getStorage();
  await storage.set({ [key]: value });
}

interface StoredSettings extends Omit<Settings, "providers"> {
  providers: Record<ProviderId, { apiKey: string; model: string }>;
}

export async function loadSettings(): Promise<Settings> {
  const raw = await readRaw<StoredSettings | null>(KEY_SETTINGS, null);
  if (!raw) return structuredClone(DEFAULT_SETTINGS);
  const providers = { ...DEFAULT_SETTINGS.providers } as Settings["providers"];
  for (const id of Object.keys(providers) as ProviderId[]) {
    const stored = raw.providers?.[id];
    if (stored) {
      providers[id] = {
        apiKey: deobfuscate(stored.apiKey ?? ""),
        model: stored.model || DEFAULT_SETTINGS.providers[id].model,
      };
    }
  }
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    providers,
  };
}

export async function saveSettings(settings: Settings): Promise<void> {
  const providers = {} as StoredSettings["providers"];
  for (const id of Object.keys(settings.providers) as ProviderId[]) {
    const conf = settings.providers[id];
    providers[id] = {
      apiKey: obfuscate(conf.apiKey ?? ""),
      model: conf.model || DEFAULT_SETTINGS.providers[id].model,
    };
  }
  const stored: StoredSettings = {
    ...settings,
    providers,
  };
  await writeRaw(KEY_SETTINGS, stored);
}

export async function loadLibrary(): Promise<LibraryState> {
  const raw = await readRaw<Partial<LibraryState> | null>(KEY_LIBRARY, null);
  if (!raw) return structuredClone(DEFAULT_LIBRARY);
  return {
    prompts: Array.isArray(raw.prompts) ? raw.prompts : [],
    folders: Array.isArray(raw.folders) ? raw.folders : [],
    pins: normalizePins(raw.pins),
  };
}

function normalizePins(raw: unknown): PinsState {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_PINS);
  const candidate = raw as Partial<PinsState>;
  const entries = Array.isArray(candidate.entries)
    ? (candidate.entries as PinnedEntry[]).filter(
        (entry) => entry && typeof entry.promptId === "string",
      )
    : [];
  return {
    entries,
    sort: candidate.sort === "lastUsed" ? "lastUsed" : "manual",
    collapsed: Boolean(candidate.collapsed),
  };
}

export async function saveLibrary(state: LibraryState): Promise<void> {
  await writeRaw(KEY_LIBRARY, state);
}

export type StorageChangeHandler = (changes: {
  settings?: Settings;
  library?: LibraryState;
}) => void;

export function subscribeStorage(handler: StorageChangeHandler): () => void {
  if (typeof chrome === "undefined" || !chrome.storage?.onChanged) {
    return () => {};
  }
  const listener = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== "local") return;
    const payload: Parameters<StorageChangeHandler>[0] = {};
    if (changes[KEY_SETTINGS]) {
      loadSettings().then((settings) => handler({ settings }));
    }
    if (changes[KEY_LIBRARY]) {
      const next = changes[KEY_LIBRARY].newValue as LibraryState | undefined;
      if (next) payload.library = next;
    }
    if (Object.keys(payload).length > 0) handler(payload);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function estimateUsageBytes(): Promise<number> {
  try {
    const storage = getStorage();
    return await new Promise<number>((resolve) => {
      storage.getBytesInUse(null, (bytes) => resolve(bytes ?? 0));
    });
  } catch {
    return 0;
  }
}

export const STORAGE_KEYS = {
  settings: KEY_SETTINGS,
  library: KEY_LIBRARY,
};
