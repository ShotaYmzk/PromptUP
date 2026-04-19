import {
  DEFAULT_ENHANCE_SYSTEM_PROMPT,
  DEFAULT_ENHANCE_USER_PROMPT_PREFIX,
} from "./enhancePrompt";

export type ProviderId = "openai" | "anthropic" | "gemini";

export type ThemeMode = "dark" | "light";

export type LanguagePref = "auto" | "ja" | "en";

export interface Prompt {
  id: string;
  title: string;
  body: string;
  description?: string;
  tags: string[];
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type TargetService = "auto" | "chatgpt" | "claude" | "gemini";

export interface PinnedSettings {
  /** Override the active model just for this pin. Falls back to provider default when unset. */
  modelOverride?: string;
  /** 0.0–2.0. When set, replaces the default enhance temperature. */
  temperature?: number;
  /** Extra system prompt snippet applied only when enhancing from this pin. */
  systemPromptOverride?: string;
  /** Preferred AI site for "Insert". "auto" = whatever tab is active. */
  targetService?: TargetService;
}

export type PinSortMode = "manual" | "lastUsed";

export interface PinnedEntry {
  promptId: string;
  pinnedAt: string;
  /** Manual drag-and-drop order; lower comes first. */
  displayOrder: number;
  /** ISO timestamp; null/absent until the pin has been inserted at least once. */
  lastUsedAt?: string;
  pinnedSettings?: PinnedSettings;
}

export interface PinsState {
  entries: PinnedEntry[];
  sort: PinSortMode;
  collapsed: boolean;
}

export const MAX_PINS = 20;

export interface LibraryState {
  prompts: Prompt[];
  folders: Folder[];
  pins: PinsState;
}

export interface ProviderConfig {
  apiKey: string;
  model: string;
}

export interface Settings {
  activeProvider: ProviderId;
  providers: Record<ProviderId, ProviderConfig>;
  theme: ThemeMode;
  language: LanguagePref;
  enhanceSystemPrompt: string;
  enhanceUserPromptPrefix: string;
  customInstruction: string;
}

export interface EnhanceOverrides {
  model?: string;
  /** 0.0–2.0 */
  temperature?: number;
  /** Appended (after newline) to the base system prompt for this request only. */
  systemPromptOverride?: string;
}

export interface EnhanceRequest {
  type: "ENHANCE_PROMPT";
  text: string;
  overrides?: EnhanceOverrides;
}

export interface EnhanceResponseOk {
  ok: true;
  text: string;
}

export interface EnhanceResponseErr {
  ok: false;
  error: EnhanceErrorCode;
  message?: string;
}

export type EnhanceResponse = EnhanceResponseOk | EnhanceResponseErr;

export type EnhanceErrorCode =
  | "NO_API_KEY"
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK"
  | "EMPTY_INPUT"
  | "PROVIDER_ERROR"
  | "UNKNOWN";

export interface OpenSidePanelMessage {
  type: "OPEN_SIDE_PANEL";
}

export interface InsertPromptMessage {
  type: "INSERT_PROMPT";
  text: string;
  /**
   * "replace" (default) overwrites the current composer content.
   * "append" keeps what the user already typed and inserts `text` after it.
   */
  mode?: "replace" | "append";
}

export interface OpenQuickSearchMessage {
  type: "OPEN_QUICK_SEARCH";
}

export type RuntimeMessage =
  | EnhanceRequest
  | OpenSidePanelMessage
  | InsertPromptMessage
  | OpenQuickSearchMessage;

export const DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-2.0-flash",
};

export const DEFAULT_SETTINGS: Settings = {
  activeProvider: "openai",
  providers: {
    openai: { apiKey: "", model: DEFAULT_MODELS.openai },
    anthropic: { apiKey: "", model: DEFAULT_MODELS.anthropic },
    gemini: { apiKey: "", model: DEFAULT_MODELS.gemini },
  },
  theme: "dark",
  language: "auto",
  enhanceSystemPrompt: DEFAULT_ENHANCE_SYSTEM_PROMPT,
  enhanceUserPromptPrefix: DEFAULT_ENHANCE_USER_PROMPT_PREFIX,
  customInstruction: "",
};

export const DEFAULT_PINS: PinsState = {
  entries: [],
  sort: "manual",
  collapsed: false,
};

export const DEFAULT_LIBRARY: LibraryState = {
  prompts: [],
  folders: [],
  pins: DEFAULT_PINS,
};
