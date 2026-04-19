import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BoltIcon,
  GearIcon,
  GripIcon,
  PinOffIcon,
  PlusIcon,
  TrashIcon,
} from "@/components/Icon";
import { hasPinOverrides } from "@/context/LibraryContext";
import { extractVariables } from "@/lib/prompt-vars";
import { MAX_PINS, PinSortMode, PinnedEntry, Prompt } from "@/lib/types";

export interface PinnedPromptView {
  prompt: Prompt;
  entry: PinnedEntry;
  /** 1-based position used for the 1–9 keyboard shortcut hint. */
  rank: number;
}

interface PinsSectionProps {
  pins: PinnedPromptView[];
  sort: PinSortMode;
  collapsed: boolean;
  onSort: (sort: PinSortMode) => void;
  onToggleCollapsed: () => void;
  onReorder: (orderedPromptIds: string[]) => void;
  onInsert: (prompt: Prompt, entry: PinnedEntry) => void;
  onAppend: (prompt: Prompt, entry: PinnedEntry) => void;
  onEnhance: (prompt: Prompt, entry: PinnedEntry) => void;
  onConfigure: (prompt: Prompt, entry: PinnedEntry) => void;
  onUnpin: (prompt: Prompt) => void;
  onDelete: (prompt: Prompt) => void;
}

export function PinsSection({
  pins,
  sort,
  collapsed,
  onSort,
  onToggleCollapsed,
  onReorder,
  onInsert,
  onAppend,
  onEnhance,
  onConfigure,
  onUnpin,
  onDelete,
}: PinsSectionProps) {
  const { t } = useTranslation();
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const remaining = Math.max(0, MAX_PINS - pins.length);

  const manualOrdered = useMemo(() => pins.slice(), [pins]);

  function handleDragStart(id: string, e: React.DragEvent<HTMLDivElement>) {
    if (sort !== "manual") return;
    setDragId(id);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", id);
    } catch {
      // ignore
    }
  }

  function handleDragOver(id: string, e: React.DragEvent<HTMLDivElement>) {
    if (sort !== "manual" || dragId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverId !== id) setDragOverId(id);
  }

  function handleDrop(targetId: string, e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (sort !== "manual" || !dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const ids = manualOrdered.map((p) => p.prompt.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    onReorder(ids);
    setDragId(null);
    setDragOverId(null);
  }

  function handleDragEnd() {
    setDragId(null);
    setDragOverId(null);
  }

  return (
    <section className="border-b border-border bg-bg-raised">
      <header className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          className="pup-btn-ghost !p-1 text-text-muted"
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? t("pins.expand") : t("pins.collapse")}
          title={collapsed ? t("pins.expand") : t("pins.collapse")}
        >
          <span
            className="inline-block transition-transform"
            style={{ transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)" }}
            aria-hidden="true"
          >
            ▾
          </span>
        </button>
        <span className="text-[11px]" aria-hidden="true">📌</span>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
          {t("pins.sectionLabel")}
        </h2>
        <span className="text-[10px] text-text-muted">
          {t("pins.count", { count: pins.length, max: MAX_PINS })}
        </span>
        <div className="ml-auto flex items-center gap-1" role="group" aria-label={t("pins.sort.label")}>
          <SortChip
            active={sort === "manual"}
            label={t("pins.sort.manual")}
            onClick={() => onSort("manual")}
          />
          <SortChip
            active={sort === "lastUsed"}
            label={t("pins.sort.lastUsed")}
            onClick={() => onSort("lastUsed")}
          />
        </div>
      </header>

      {!collapsed && (
        <div className="px-3 pb-3 pt-0">
          <div className="space-y-1.5">
            {manualOrdered.map((view) => (
              <PinCard
                key={view.prompt.id}
                view={view}
                sort={sort}
                dragging={dragId === view.prompt.id}
                dragOver={dragOverId === view.prompt.id}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onInsert={() => onInsert(view.prompt, view.entry)}
                onAppend={() => onAppend(view.prompt, view.entry)}
                onEnhance={() => onEnhance(view.prompt, view.entry)}
                onConfigure={() => onConfigure(view.prompt, view.entry)}
                onUnpin={() => onUnpin(view.prompt)}
                onDelete={() => onDelete(view.prompt)}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] text-text-muted">
            <span>{t("pins.shortcutHint")}</span>
            <span>{t("pins.remaining", { count: remaining })}</span>
          </div>
        </div>
      )}
    </section>
  );
}

function SortChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={[
        "pup-chip !px-2 !py-0.5 text-[10px]",
        active ? "pup-chip-active" : "",
      ].join(" ")}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

interface PinCardProps {
  view: PinnedPromptView;
  sort: PinSortMode;
  dragging: boolean;
  dragOver: boolean;
  onDragStart: (id: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (id: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDrop: (id: string, e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onInsert: () => void;
  onAppend: () => void;
  onEnhance: () => void;
  onConfigure: () => void;
  onUnpin: () => void;
  onDelete: () => void;
}

function PinCard({
  view,
  sort,
  dragging,
  dragOver,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onInsert,
  onAppend,
  onEnhance,
  onConfigure,
  onUnpin,
  onDelete,
}: PinCardProps) {
  const { t } = useTranslation();
  const { prompt, entry, rank } = view;
  const variables = useMemo(
    () => extractVariables(prompt.body),
    [prompt.body],
  );
  const overrides = hasPinOverrides(entry.pinnedSettings);
  const shortcutLabel = rank <= 9 ? String(rank) : null;
  const manual = sort === "manual";
  const preview = prompt.body.replace(/\s+/g, " ").trim().slice(0, 120);

  return (
    <div
      draggable={manual}
      onDragStart={(e) => onDragStart(prompt.id, e)}
      onDragOver={(e) => onDragOver(prompt.id, e)}
      onDrop={(e) => onDrop(prompt.id, e)}
      onDragEnd={onDragEnd}
      className={[
        "group rounded-lg border px-2 py-2 transition-colors",
        dragging ? "opacity-60" : "",
        dragOver
          ? "border-brand bg-bg-hover"
          : "border-border bg-surface-muted hover:bg-bg-hover",
      ].join(" ")}
      aria-label={prompt.title}
    >
      <div className="flex items-start gap-2">
        {manual && (
          <span
            className="mt-0.5 cursor-grab text-text-muted opacity-50 group-hover:opacity-100"
            aria-hidden="true"
            title={t("pins.sort.manual")}
          >
            <GripIcon width={12} height={12} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {shortcutLabel && (
              <kbd className="rounded border border-border bg-bg-base px-1 py-px font-mono text-[9px] text-text-muted">
                {shortcutLabel}
              </kbd>
            )}
            <span className="truncate text-xs font-semibold">
              {prompt.title}
            </span>
            {variables.length > 0 && (
              <span
                className="pup-chip !px-1.5 !py-0 !text-[9px]"
                title={`${t("pins.variableBadge")}: ${variables.join(", ")}`}
              >
                {"{x}"}
              </span>
            )}
            {overrides && (
              <span
                className="pup-chip !px-1.5 !py-0 !text-[9px]"
                title={t("pins.overrides")}
              >
                <GearIcon width={9} height={9} />
              </span>
            )}
          </div>
          {preview && (
            <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-text-muted">
              {preview}
              {prompt.body.length > preview.length ? "…" : ""}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 group-hover:opacity-100">
          <button
            type="button"
            className="pup-btn-ghost !p-1"
            title={t("pins.configure")}
            aria-label={t("pins.configure")}
            onClick={onConfigure}
          >
            <GearIcon width={12} height={12} />
          </button>
          <button
            type="button"
            className="pup-btn-ghost !p-1"
            title={t("pins.unpin")}
            aria-label={t("pins.unpin")}
            onClick={onUnpin}
          >
            <PinOffIcon width={12} height={12} />
          </button>
          <button
            type="button"
            className="pup-btn-ghost !p-1 text-danger"
            title={t("pins.delete")}
            aria-label={t("pins.delete")}
            onClick={onDelete}
          >
            <TrashIcon width={12} height={12} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          className="pup-btn-secondary flex-1 basis-[3.5rem] min-w-[3rem] whitespace-nowrap !py-1 text-[11px]"
          onClick={onInsert}
        >
          {t("pins.insert")}
        </button>
        <button
          type="button"
          className="pup-btn-secondary flex-1 basis-[3.5rem] min-w-[3rem] whitespace-nowrap !py-1 text-[11px]"
          onClick={onAppend}
          title={t("pins.appendHint")}
          aria-label={t("pins.appendHint")}
        >
          <PlusIcon width={11} height={11} />
          {t("pins.append")}
        </button>
        <button
          type="button"
          className="pup-btn-primary flex-1 basis-[3.5rem] min-w-[3rem] whitespace-nowrap !py-1 text-[11px]"
          onClick={onEnhance}
        >
          <BoltIcon width={11} height={11} />
          {t("pins.enhance")}
        </button>
      </div>
    </div>
  );
}

export function sortPinViews(
  entries: PinnedEntry[],
  prompts: Prompt[],
  sort: PinSortMode,
): PinnedPromptView[] {
  const lookup = new Map(prompts.map((p) => [p.id, p]));
  const hydrated = entries
    .map((entry) => {
      const prompt = lookup.get(entry.promptId);
      return prompt ? { prompt, entry } : null;
    })
    .filter((v): v is { prompt: Prompt; entry: PinnedEntry } => v !== null);

  const ordered = (() => {
    if (sort === "lastUsed") {
      return hydrated.slice().sort((a, b) => {
        const at = a.entry.lastUsedAt ?? a.entry.pinnedAt;
        const bt = b.entry.lastUsedAt ?? b.entry.pinnedAt;
        return at < bt ? 1 : -1;
      });
    }
    return hydrated.slice().sort((a, b) => {
      const da = a.entry.displayOrder ?? 0;
      const db = b.entry.displayOrder ?? 0;
      if (da !== db) return da - db;
      return a.entry.pinnedAt < b.entry.pinnedAt ? -1 : 1;
    });
  })();

  return ordered.map((view, index) => ({ ...view, rank: index + 1 }));
}
