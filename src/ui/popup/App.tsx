import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLibrary } from "@/context/LibraryContext";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/components/Toast";
import { Prompt } from "@/lib/types";
import { extractVariables, hasVariables } from "@/lib/prompt-vars";
import { ArrowRightIcon, SparkIcon } from "@/components/Icon";

export function PopupApp() {
  const { t } = useTranslation();
  const { settings } = useSettings();
  const { notify } = useToast();
  const { state, touchUsage } = useLibrary();

  const recent = useMemo(() => {
    return state.prompts
      .slice()
      .sort((a, b) => {
        if (a.usageCount !== b.usageCount) return b.usageCount - a.usageCount;
        return a.updatedAt < b.updatedAt ? 1 : -1;
      })
      .slice(0, 3);
  }, [state.prompts]);

  const isMac = navigator.platform.toLowerCase().includes("mac");
  const comboOpen = isMac ? "⌘⇧U" : "Ctrl+Shift+U";
  const comboSearch = isMac ? "⌘⇧P" : "Ctrl+Shift+P";

  async function openSidePanel() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.windowId !== undefined) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        window.close();
      } catch (error) {
        notify((error as Error)?.message ?? "", "error");
      }
    }
  }

  async function insertRecent(prompt: Prompt) {
    if (hasVariables(prompt.body) && extractVariables(prompt.body).length > 0) {
      await openSidePanel();
      return;
    }
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    try {
      await touchUsage(prompt.id);
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: "INSERT_PROMPT",
        text: prompt.body,
      });
      if (response?.ok) {
        notify(t("toast.inserted"), "success");
        window.close();
      } else {
        await navigator.clipboard.writeText(prompt.body);
        notify(t("common.copied"), "info");
      }
    } catch {
      await navigator.clipboard.writeText(prompt.body);
      notify(t("common.copied"), "info");
    }
  }

  const activeConfig = settings.providers[settings.activeProvider];

  return (
    <div className="flex min-h-[320px] flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-brand-fg">
          <SparkIcon width={16} height={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{t("app.name")}</div>
          <div className="truncate text-[11px] text-text-muted">
            {t("app.tagline")}
          </div>
        </div>
      </header>

      {!activeConfig.apiKey && (
        <div className="rounded-md border border-[rgba(251,191,36,0.4)] bg-[rgba(251,191,36,0.12)] px-2.5 py-2 text-[11px] text-warn">
          {t("enhance.errors.NO_API_KEY")}
        </div>
      )}

      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
            {t("popup.recent")}
          </h2>
        </div>
        {recent.length === 0 ? (
          <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-[11px] text-text-muted">
            {t("popup.noRecent")}
          </div>
        ) : (
          <ul className="space-y-1.5">
            {recent.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="w-full rounded-md border border-border bg-bg-raised px-3 py-2 text-left transition-colors hover:bg-bg-hover"
                  onClick={() => insertRecent(p)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {p.title}
                    </span>
                    <ArrowRightIcon
                      width={12}
                      height={12}
                      className="shrink-0 text-text-muted"
                    />
                  </div>
                  <div className="truncate text-[11px] text-text-muted">
                    {p.body.slice(0, 60)}
                    {p.body.length > 60 ? "…" : ""}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-auto space-y-2">
        <button
          type="button"
          className="pup-btn-primary w-full"
          onClick={openSidePanel}
        >
          {t("popup.openLibrary")}
        </button>
        <div className="flex items-center justify-between text-[11px] text-text-muted">
          <span>
            {t("popup.quickSearchHint", { key: comboSearch })}
          </span>
          <span className="font-mono">{comboOpen}</span>
        </div>
        <button
          type="button"
          className="w-full text-center text-[11px] text-text-muted hover:text-text"
          onClick={() => chrome.runtime.openOptionsPage()}
        >
          {t("nav.openOptions")}
        </button>
      </div>
    </div>
  );
}
