import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PinLimitError, useLibrary } from "@/context/LibraryContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/components/Toast";
import {
  EnhanceOverrides,
  MAX_PINS,
  PinnedEntry,
  PinnedSettings,
  Prompt,
  TargetService,
} from "@/lib/types";
import { extractVariables } from "@/lib/prompt-vars";
import { sendEnhanceRequest } from "@/lib/messaging";
import {
  FolderIcon,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
  TrashIcon,
} from "@/components/Icon";
import { PromptEditor } from "./PromptEditor";
import { VariableDialog } from "./VariableDialog";
import { PinSettingsDialog } from "./PinSettingsDialog";
import { PinsSection, sortPinViews } from "./PinsSection";
import { SettingsView } from "./SettingsView";

type FolderKey = string | "__all__" | "__none__";
type InsertMode = "insert" | "append" | "enhance";

const SIDEBAR_WIDTH_KEY = "promptup:sidebar-width";
const SIDEBAR_WIDTH_MIN = 96;
const SIDEBAR_WIDTH_MAX = 320;
const SIDEBAR_WIDTH_DEFAULT = 128;

function readSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (!raw) return SIDEBAR_WIDTH_DEFAULT;
    const n = Number(raw);
    if (!Number.isFinite(n)) return SIDEBAR_WIDTH_DEFAULT;
    return Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(n)));
  } catch {
    return SIDEBAR_WIDTH_DEFAULT;
  }
}

const SERVICE_HOSTS: Partial<Record<TargetService, string>> = {
  chatgpt: "chatgpt.com",
  claude: "claude.ai",
  gemini: "gemini.google.com",
};

const SERVICE_URLS: Partial<Record<TargetService, string>> = {
  chatgpt: "https://chatgpt.com/",
  claude: "https://claude.ai/new",
  gemini: "https://gemini.google.com/",
};

function safeHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function buildEnhanceOverrides(
  settings: PinnedSettings | undefined,
): EnhanceOverrides | undefined {
  if (!settings) return undefined;
  const overrides: EnhanceOverrides = {};
  if (settings.modelOverride) overrides.model = settings.modelOverride;
  if (typeof settings.temperature === "number") {
    overrides.temperature = settings.temperature;
  }
  if (settings.systemPromptOverride) {
    overrides.systemPromptOverride = settings.systemPromptOverride;
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function SidePanelApp() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { notify } = useToast();
  const lib = useLibrary();
  const {
    state,
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
  } = lib;

  const [activeFolder, setActiveFolder] = useState<FolderKey>("__all__");
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null);
  const [pendingInsert, setPendingInsert] = useState<{
    prompt: Prompt;
    mode: InsertMode;
    entry?: PinnedEntry;
  } | null>(null);
  const [pinConfig, setPinConfig] = useState<{
    prompt: Prompt;
    entry: PinnedEntry;
  } | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() =>
    readSidebarWidth(),
  );
  const sidebarResizeRef = useRef<{ startX: number; startWidth: number } | null>(
    null,
  );
  const [view, setView] = useState<"library" | "settings">("library");

  const pinViews = useMemo(
    () => sortPinViews(state.pins.entries, state.prompts, state.pins.sort),
    [state.pins.entries, state.pins.sort, state.prompts],
  );

  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const p of state.prompts) for (const tag of p.tags) set.add(tag);
    return Array.from(set).sort();
  }, [state.prompts]);

  const filtered = useMemo(() => {
    let list = state.prompts;
    if (activeFolder === "__none__") {
      list = list.filter((p) => !p.folderId);
    } else if (activeFolder !== "__all__") {
      list = list.filter((p) => p.folderId === activeFolder);
    }
    if (activeTag) list = list.filter((p) => p.tags.includes(activeTag));
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.body.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return list
      .slice()
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }, [state.prompts, activeFolder, activeTag, query]);

  async function handleCreateFolder() {
    const name = window.prompt(t("library.folderName"));
    if (!name) return;
    await createFolder(name);
    notify(t("toast.saved"), "success");
  }

  async function handleRenameFolder(id: string, current: string) {
    const name = window.prompt(t("library.renameFolder"), current);
    if (!name) return;
    await renameFolder(id, name);
  }

  async function handleDeleteFolder(id: string) {
    if (!window.confirm(t("library.confirmDeleteFolder"))) return;
    await deleteFolder(id);
    if (activeFolder === id) setActiveFolder("__all__");
  }

  async function handleDeletePrompt(prompt: Prompt) {
    if (!window.confirm(`${t("common.delete")}: ${prompt.title}?`)) return;
    await deletePrompt(prompt.id);
    notify(t("toast.deleted"), "success");
  }

  async function insertIntoActiveTab(
    text: string,
    targetService: TargetService = "auto",
    insertMode: "replace" | "append" = "replace",
  ) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentHost = tab?.url ? safeHostname(tab.url) : "";
    const wantedHost = SERVICE_HOSTS[targetService];

    // If the pin specifies a service and we're not already on it, open that
    // service in a new tab and stash the text on the clipboard so the user
    // can paste instantly once the page loads.
    if (wantedHost && !currentHost.endsWith(wantedHost)) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // ignore
      }
      await chrome.tabs.create({ url: SERVICE_URLS[targetService]! });
      notify(t("common.copied"), "info");
      return;
    }

    if (!tab?.id) {
      await navigator.clipboard.writeText(text);
      notify(t("common.copied"), "info");
      return;
    }
    try {
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "INSERT_PROMPT",
        text,
        mode: insertMode,
      });
      if (response?.ok) {
        notify(t("toast.inserted"), "success");
        return;
      }
      throw new Error("no response");
    } catch {
      await navigator.clipboard.writeText(text);
      notify(t("common.copied"), "info");
    }
  }

  async function runInsert(
    prompt: Prompt,
    mode: InsertMode,
    entry?: PinnedEntry,
  ) {
    const vars = extractVariables(prompt.body);
    if (vars.length > 0) {
      setPendingInsert({ prompt, mode, entry });
      return;
    }
    await finalizeInsert(prompt, prompt.body, mode, entry);
  }

  async function finalizeInsert(
    prompt: Prompt,
    finalText: string,
    mode: InsertMode,
    entry?: PinnedEntry,
  ) {
    const pinSettings = entry?.pinnedSettings;
    await touchUsage(prompt.id);
    if (entry) await touchPinUsage(prompt.id);

    if (mode === "enhance") {
      notify(t("enhance.loading"), "info");
      const overrides = buildEnhanceOverrides(pinSettings);
      const response = await sendEnhanceRequest(finalText, overrides);
      if (!response.ok) {
        notify(
          t(`enhance.errors.${response.error}` as const, {
            defaultValue: response.message ?? "",
          }),
          "error",
        );
        return;
      }
      await insertIntoActiveTab(
        response.text,
        pinSettings?.targetService ?? "auto",
        "replace",
      );
    } else {
      await insertIntoActiveTab(
        finalText,
        pinSettings?.targetService ?? "auto",
        mode === "append" ? "append" : "replace",
      );
    }
  }

  async function togglePin(prompt: Prompt) {
    if (isPinned(prompt.id)) {
      await unpinPrompt(prompt.id);
      notify(t("toast.unpinned"), "success");
      return;
    }
    try {
      await pinPrompt(prompt.id);
      notify(t("toast.pinned"), "success");
    } catch (error) {
      if (error instanceof PinLimitError) {
        notify(t("pins.limitReached", { max: MAX_PINS }), "error");
        return;
      }
      throw error;
    }
  }

  async function handlePinDelete(prompt: Prompt) {
    if (!window.confirm(t("pins.confirmDelete"))) return;
    await deletePrompt(prompt.id);
    notify(t("toast.deleted"), "success");
  }

  async function handlePinSettings(
    prompt: Prompt,
    settings: PinnedSettings | undefined,
  ) {
    await updatePinSettings(prompt.id, settings);
    notify(t("toast.saved"), "success");
  }

  async function savePrompt(
    draft: {
      title: string;
      body: string;
      description?: string;
      tags: string[];
      folderId: string | null;
    },
    existingId?: string,
  ) {
    if (existingId) {
      await updatePrompt(existingId, draft);
    } else {
      await createPrompt(draft);
    }
    notify(t("toast.saved"), "success");
  }

  const activeProviderLabel = t(
    `options.provider.${settings.activeProvider}` as
      | "options.provider.openai"
      | "options.provider.anthropic"
      | "options.provider.gemini",
  );

  // Persist sidebar width whenever it changes.
  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
    } catch {
      // ignore
    }
  }, [sidebarWidth]);

  function handleSidebarResizeStart(
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>,
  ) {
    e.preventDefault();
    const clientX =
      "touches" in e ? e.touches[0]?.clientX ?? 0 : (e as React.MouseEvent).clientX;
    sidebarResizeRef.current = {
      startX: clientX,
      startWidth: sidebarWidth,
    };
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev: MouseEvent | TouchEvent) => {
      const state = sidebarResizeRef.current;
      if (!state) return;
      const x =
        "touches" in ev
          ? ev.touches[0]?.clientX ?? state.startX
          : (ev as MouseEvent).clientX;
      const next = Math.min(
        SIDEBAR_WIDTH_MAX,
        Math.max(SIDEBAR_WIDTH_MIN, state.startWidth + (x - state.startX)),
      );
      setSidebarWidth(next);
    };
    const onEnd = () => {
      sidebarResizeRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
  }

  function handleSidebarResizeReset() {
    setSidebarWidth(SIDEBAR_WIDTH_DEFAULT);
  }

  // Keyboard shortcuts: 1-9 insert the top pinned prompts when focus is not
  // inside a text field. Uses the current (possibly lastUsed-sorted) order so
  // the numbered pins always match what the user sees.
  const pinViewsRef = useRef(pinViews);
  pinViewsRef.current = pinViews;
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key < "1" || e.key > "9") return;
      const index = Number(e.key) - 1;
      const pinView = pinViewsRef.current[index];
      if (!pinView) return;
      e.preventDefault();
      void runInsert(pinView.prompt, "insert", pinView.entry);
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-screen flex-col bg-bg-base">
      <header className="flex items-center gap-2 border-b border-border bg-bg-raised px-3 py-3">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg">
          <SparkIcon width={16} height={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{t("library.title")}</div>
          <div className="truncate text-[11px] text-text-muted">
            {activeProviderLabel}
            {settings.providers[settings.activeProvider].apiKey
              ? ""
              : ` · ${t("enhance.errors.NO_API_KEY")}`}
          </div>
        </div>
        <button
          type="button"
          className={[
            "pup-btn-ghost !p-2",
            view === "settings" ? "text-brand" : "",
          ].join(" ")}
          title={t("nav.openOptions")}
          aria-label={t("nav.openOptions")}
          aria-pressed={view === "settings"}
          onClick={() =>
            setView((v) => (v === "settings" ? "library" : "settings"))
          }
        >
          ⚙
        </button>
      </header>

      {view === "settings" ? (
        <SettingsView onBack={() => setView("library")} />
      ) : (
      <>
      <div className="space-y-2 border-b border-border px-3 py-2">
        <div className="relative">
          <SearchIcon
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted"
            width={14}
            height={14}
          />
          <input
            className="pup-input !pl-8"
            placeholder={t("library.searchPlaceholder")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              className={[
                "pup-chip",
                activeTag === null ? "pup-chip-active" : "",
              ].join(" ")}
              onClick={() => setActiveTag(null)}
            >
              #all
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className={[
                  "pup-chip",
                  activeTag === tag ? "pup-chip-active" : "",
                ].join(" ")}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {pinViews.length > 0 && (
        <PinsSection
          pins={pinViews}
          sort={state.pins.sort}
          collapsed={state.pins.collapsed}
          onSort={(sort) => void setPinSort(sort)}
          onToggleCollapsed={() =>
            void setPinsCollapsed(!state.pins.collapsed)
          }
          onReorder={(ids) => void reorderPins(ids)}
          onInsert={(prompt, entry) => void runInsert(prompt, "insert", entry)}
          onAppend={(prompt, entry) => void runInsert(prompt, "append", entry)}
          onEnhance={(prompt, entry) =>
            void runInsert(prompt, "enhance", entry)
          }
          onConfigure={(prompt, entry) => setPinConfig({ prompt, entry })}
          onUnpin={(prompt) => void togglePin(prompt)}
          onDelete={(prompt) => void handlePinDelete(prompt)}
        />
      )}

      <div className="flex min-h-0 flex-1">
        <aside
          className="flex-shrink-0 space-y-0.5 overflow-y-auto bg-surface-muted px-2 py-2 text-xs"
          style={{
            width: `min(${sidebarWidth}px, 45%)`,
            minWidth: `${SIDEBAR_WIDTH_MIN}px`,
          }}
        >
          <FolderButton
            label={t("library.allPrompts")}
            active={activeFolder === "__all__"}
            onSelect={() => setActiveFolder("__all__")}
          />
          <FolderButton
            label={t("library.uncategorized")}
            active={activeFolder === "__none__"}
            onSelect={() => setActiveFolder("__none__")}
          />
          {state.folders.map((folder) => (
            <div
              key={folder.id}
              className="group flex items-center gap-1"
            >
              <FolderButton
                label={folder.name}
                active={activeFolder === folder.id}
                onSelect={() => setActiveFolder(folder.id)}
              />
              <div className="flex opacity-0 group-hover:opacity-100">
                <button
                  type="button"
                  className="pup-btn-ghost !p-1"
                  title={t("library.renameFolder")}
                  onClick={() => handleRenameFolder(folder.id, folder.name)}
                >
                  <PencilIcon width={12} height={12} />
                </button>
                <button
                  type="button"
                  className="pup-btn-ghost !p-1 text-danger"
                  title={t("library.deleteFolder")}
                  onClick={() => handleDeleteFolder(folder.id)}
                >
                  <TrashIcon width={12} height={12} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className="pup-btn-ghost w-full justify-start !px-2 !py-1.5 text-[11px]"
            onClick={handleCreateFolder}
          >
            <PlusIcon width={12} height={12} />
            {t("library.newFolder")}
          </button>
        </aside>

        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("library.resizeSidebar")}
          title={t("library.resizeSidebar")}
          onMouseDown={handleSidebarResizeStart}
          onTouchStart={handleSidebarResizeStart}
          onDoubleClick={handleSidebarResizeReset}
          className="group relative w-1 shrink-0 cursor-col-resize select-none bg-border hover:bg-brand"
        >
          <span
            className="pointer-events-none absolute inset-y-0 -left-1 -right-1"
            aria-hidden="true"
          />
        </div>

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-3 py-2 text-[11px] text-text-muted">
            <span>
              {t("library.totalCount", { count: filtered.length })}
            </span>
            <button
              type="button"
              className="pup-btn-primary !py-1 !px-2 text-xs"
              onClick={() => {
                setEditingPrompt(null);
                setEditorOpen(true);
              }}
            >
              <PlusIcon width={12} height={12} />
              {t("library.newPrompt")}
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-4">
            {filtered.length === 0 ? (
              <div className="mt-8 text-center text-xs text-text-muted">
                {t("library.noPrompts")}
              </div>
            ) : (
              filtered.map((prompt) => (
                <PromptRow
                  key={prompt.id}
                  prompt={prompt}
                  folders={state.folders}
                  pinned={isPinned(prompt.id)}
                  onTogglePin={() => void togglePin(prompt)}
                  onEdit={() => {
                    setEditingPrompt(prompt);
                    setEditorOpen(true);
                  }}
                  onDelete={() => handleDeletePrompt(prompt)}
                  onInsert={() => runInsert(prompt, "insert")}
                  onAppend={() => runInsert(prompt, "append")}
                  onEnhance={() => runInsert(prompt, "enhance")}
                />
              ))
            )}
          </div>
        </main>
      </div>
      </>
      )}

      <PromptEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={savePrompt}
        folders={state.folders}
        editing={editingPrompt}
        pinned={editingPrompt ? isPinned(editingPrompt.id) : false}
        onTogglePin={(prompt) => void togglePin(prompt)}
        initialFolderId={
          activeFolder === "__all__" || activeFolder === "__none__"
            ? null
            : activeFolder
        }
      />

      <VariableDialog
        open={pendingInsert !== null}
        onClose={() => setPendingInsert(null)}
        body={pendingInsert?.prompt.body ?? ""}
        variables={
          pendingInsert ? extractVariables(pendingInsert.prompt.body) : []
        }
        onSubmit={(filled) => {
          if (!pendingInsert) return;
          const { prompt, mode, entry } = pendingInsert;
          void finalizeInsert(prompt, filled, mode, entry);
        }}
      />

      <PinSettingsDialog
        open={pinConfig !== null}
        prompt={pinConfig?.prompt ?? null}
        initialSettings={pinConfig?.entry.pinnedSettings}
        onClose={() => setPinConfig(null)}
        onSave={(settings) =>
          pinConfig ? handlePinSettings(pinConfig.prompt, settings) : undefined
        }
      />
    </div>
  );
}

function FolderButton({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left transition-colors",
        active
          ? "bg-brand text-brand-fg"
          : "text-text-muted hover:bg-bg-hover hover:text-text",
      ].join(" ")}
    >
      <FolderIcon width={12} height={12} />
      <span className="truncate">{label}</span>
    </button>
  );
}

function PromptRow({
  prompt,
  folders,
  pinned,
  onTogglePin,
  onEdit,
  onDelete,
  onInsert,
  onAppend,
  onEnhance,
}: {
  prompt: Prompt;
  folders: import("@/lib/types").Folder[];
  pinned: boolean;
  onTogglePin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onInsert: () => void;
  onAppend: () => void;
  onEnhance: () => void;
}) {
  const { t } = useTranslation();
  const folder = folders.find((f) => f.id === prompt.folderId);
  return (
    <div className="pup-card group space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{prompt.title}</span>
            {pinned && (
              <span
                className="text-warn"
                title={t("pins.pinned")}
                aria-label={t("pins.pinned")}
              >
                <PinIcon width={12} height={12} />
              </span>
            )}
          </div>
          {prompt.description && (
            <div className="line-clamp-2 text-[11px] text-text-muted">
              {prompt.description}
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button
            type="button"
            className={[
              "pup-btn-ghost !p-1",
              pinned
                ? "text-warn"
                : "text-text-muted opacity-0 group-hover:opacity-100 focus:opacity-100",
            ].join(" ")}
            title={pinned ? t("pins.unpin") : t("pins.pin")}
            aria-label={pinned ? t("pins.unpin") : t("pins.pin")}
            aria-pressed={pinned}
            onClick={onTogglePin}
          >
            <PinIcon width={14} height={14} />
          </button>
          <button
            type="button"
            className="pup-btn-ghost !p-1"
            title={t("common.edit")}
            onClick={onEdit}
          >
            <PencilIcon width={14} height={14} />
          </button>
          <button
            type="button"
            className="pup-btn-ghost !p-1 text-danger"
            title={t("common.delete")}
            onClick={onDelete}
          >
            <TrashIcon width={14} height={14} />
          </button>
        </div>
      </div>
      <pre className="max-h-20 overflow-hidden rounded-md bg-surface-muted px-2 py-1.5 text-[11px] leading-relaxed whitespace-pre-wrap break-words text-text-muted">
        {prompt.body.slice(0, 200)}
        {prompt.body.length > 200 ? "…" : ""}
      </pre>
      <div className="flex flex-wrap items-center gap-1">
        {prompt.tags.map((tag) => (
          <span key={tag} className="pup-chip">
            #{tag}
          </span>
        ))}
        {folder && (
          <span className="pup-chip">
            <FolderIcon width={10} height={10} />
            {folder.name}
          </span>
        )}
        <span className="ml-auto text-[10px] text-text-muted">
          {t("library.usageCount", { count: prompt.usageCount })}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="pup-btn-secondary flex-1 basis-[4.5rem] min-w-[4rem] whitespace-nowrap !py-1.5 text-xs"
          onClick={onInsert}
        >
          {t("library.insert")}
        </button>
        <button
          type="button"
          className="pup-btn-secondary flex-1 basis-[5rem] min-w-[4.5rem] whitespace-nowrap !py-1.5 text-xs"
          onClick={onAppend}
          title={t("library.appendHint")}
        >
          <PlusIcon width={12} height={12} />
          {t("library.append")}
        </button>
        <button
          type="button"
          className="pup-btn-primary flex-1 basis-[6rem] min-w-[5rem] whitespace-nowrap !py-1.5 text-xs"
          onClick={onEnhance}
        >
          <SparkIcon width={12} height={12} />
          {t("library.enhance")}
        </button>
      </div>
    </div>
  );
}
