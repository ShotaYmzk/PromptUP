import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettings } from "@/context/SettingsContext";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_MODELS,
  LanguagePref,
  ProviderId,
  Settings,
  ThemeMode,
} from "@/lib/types";
import {
  DEFAULT_ENHANCE_SYSTEM_PROMPT,
  DEFAULT_ENHANCE_USER_PROMPT_PREFIX,
} from "@/lib/enhancePrompt";
import { ArrowRightIcon, SparkIcon } from "@/components/Icon";

interface ProviderMeta {
  id: ProviderId;
  labelKey:
    | "options.provider.openai"
    | "options.provider.anthropic"
    | "options.provider.gemini";
  docs: string;
  keyHint: string;
}

const PROVIDER_META: ProviderMeta[] = [
  {
    id: "openai",
    labelKey: "options.provider.openai",
    docs: "https://platform.openai.com/api-keys",
    keyHint: "sk-...",
  },
  {
    id: "anthropic",
    labelKey: "options.provider.anthropic",
    docs: "https://console.anthropic.com/settings/keys",
    keyHint: "sk-ant-...",
  },
  {
    id: "gemini",
    labelKey: "options.provider.gemini",
    docs: "https://aistudio.google.com/app/apikey",
    keyHint: "AIza...",
  },
];

export function SettingsView({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation();
  const { settings, loading, replace } = useSettings();
  const { notify } = useToast();

  const [draft, setDraft] = useState<Settings>(settings);
  const [showKey, setShowKey] = useState<Record<ProviderId, boolean>>({
    openai: false,
    anthropic: false,
    gemini: false,
  });

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(settings),
    [draft, settings],
  );

  const activeMeta = PROVIDER_META.find((m) => m.id === draft.activeProvider)!;
  const activeConfig = draft.providers[draft.activeProvider];

  async function handleSave() {
    await replace(draft);
    notify(t("options.provider.saved"), "success");
  }

  function updateActiveProvider(
    patch: Partial<Settings["providers"][ProviderId]>,
  ) {
    setDraft((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [prev.activeProvider]: {
          ...prev.providers[prev.activeProvider],
          ...patch,
        },
      },
    }));
  }

  if (loading) {
    return (
      <div className="p-6 text-center text-xs text-text-muted">
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-bg-raised px-3 py-2">
        <button
          type="button"
          className="pup-btn-ghost !p-1"
          onClick={onBack}
          aria-label={t("common.back")}
          title={t("common.back")}
        >
          <span style={{ transform: "rotate(180deg)", display: "inline-flex" }}>
            <ArrowRightIcon width={14} height={14} />
          </span>
        </button>
        <h2 className="text-sm font-semibold">{t("options.title")}</h2>
        <button
          type="button"
          className="ml-auto text-[10px] text-text-muted hover:text-text"
          onClick={() => chrome.runtime.openOptionsPage()}
          title={t("options.openFullPage")}
        >
          {t("options.openFullPage")}
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 py-3">
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {t("options.sections.provider")}
          </h3>

          <div className="grid grid-cols-3 gap-1.5">
            {PROVIDER_META.map((meta) => (
              <button
                key={meta.id}
                type="button"
                onClick={() =>
                  setDraft((prev) => ({ ...prev, activeProvider: meta.id }))
                }
                className={[
                  "rounded-md border px-1.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap",
                  draft.activeProvider === meta.id
                    ? "border-brand bg-[rgba(139,92,246,0.12)] text-text"
                    : "border-border bg-bg-raised text-text-muted hover:text-text",
                ].join(" ")}
                aria-pressed={draft.activeProvider === meta.id}
              >
                {t(meta.labelKey)}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2 rounded-lg border border-border bg-surface-muted p-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-semibold">{t(activeMeta.labelKey)}</div>
            <a
              href={activeMeta.docs}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] text-brand hover:underline"
            >
              {t("options.provider.getKey")}
            </a>
          </div>

          <div>
            <label className="pup-label !text-[11px]" htmlFor="sp-apikey">
              {t("options.provider.apiKey")}
            </label>
            <div className="flex gap-1.5">
              <input
                id="sp-apikey"
                className="pup-input font-mono text-[12px]"
                type={showKey[draft.activeProvider] ? "text" : "password"}
                placeholder={activeMeta.keyHint}
                value={activeConfig.apiKey}
                onChange={(e) => updateActiveProvider({ apiKey: e.target.value })}
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="pup-btn-secondary whitespace-nowrap !px-2 !py-1 text-[11px]"
                onClick={() =>
                  setShowKey((prev) => ({
                    ...prev,
                    [draft.activeProvider]: !prev[draft.activeProvider],
                  }))
                }
              >
                {showKey[draft.activeProvider]
                  ? t("options.provider.hideKey")
                  : t("options.provider.showKey")}
              </button>
            </div>
            <p className="mt-1 text-[10px] text-text-muted">
              {t("options.provider.apiKeyHint")}
            </p>
          </div>

          <div>
            <label className="pup-label !text-[11px]" htmlFor="sp-model">
              {t("options.provider.model")}
            </label>
            <input
              id="sp-model"
              className="pup-input text-[12px]"
              value={activeConfig.model}
              placeholder={DEFAULT_MODELS[draft.activeProvider]}
              onChange={(e) => updateActiveProvider({ model: e.target.value })}
              spellCheck={false}
            />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {t("options.sections.appearance")}
          </h3>

          <div>
            <span className="pup-label !text-[11px]">
              {t("options.appearance.theme")}
            </span>
            <div className="inline-flex rounded-md border border-border bg-bg-raised p-0.5">
              {(["dark", "light"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={[
                    "rounded px-2 py-1 text-[11px] transition-colors",
                    draft.theme === mode
                      ? "bg-brand text-brand-fg"
                      : "text-text-muted hover:text-text",
                  ].join(" ")}
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, theme: mode }))
                  }
                  aria-pressed={draft.theme === mode}
                >
                  {mode === "dark"
                    ? t("options.appearance.themeDark")
                    : t("options.appearance.themeLight")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="pup-label !text-[11px]" htmlFor="sp-language">
              {t("options.appearance.language")}
            </label>
            <select
              id="sp-language"
              className="pup-input text-[12px]"
              value={draft.language}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  language: e.target.value as LanguagePref,
                }))
              }
            >
              <option value="auto">
                {t("options.appearance.languageAuto")}
              </option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            {t("options.sections.enhancement")}
          </h3>

          <div>
            <label className="pup-label !text-[11px]" htmlFor="sp-system-prompt">
              {t("options.enhancement.systemPrompt")}
            </label>
            <textarea
              id="sp-system-prompt"
              className="pup-textarea min-h-[96px] text-[12px]"
              rows={5}
              value={draft.enhanceSystemPrompt}
              placeholder={DEFAULT_ENHANCE_SYSTEM_PROMPT}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  enhanceSystemPrompt: e.target.value,
                }))
              }
            />
            <p className="mt-1 text-[10px] text-text-muted">
              {t("options.enhancement.systemPromptHint")}
            </p>
          </div>

          <div>
            <label
              className="pup-label !text-[11px]"
              htmlFor="sp-user-prompt-prefix"
            >
              {t("options.enhancement.userPromptPrefix")}
            </label>
            <input
              id="sp-user-prompt-prefix"
              className="pup-input text-[12px]"
              value={draft.enhanceUserPromptPrefix}
              placeholder={DEFAULT_ENHANCE_USER_PROMPT_PREFIX}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  enhanceUserPromptPrefix: e.target.value,
                }))
              }
              spellCheck={false}
            />
            <p className="mt-1 text-[10px] text-text-muted">
              {t("options.enhancement.userPromptPrefixHint")}
            </p>
          </div>

          <div>
            <label
              className="pup-label !text-[11px]"
              htmlFor="sp-custom-instruction"
            >
              {t("options.enhancement.customInstruction")}
            </label>
            <textarea
              id="sp-custom-instruction"
              className="pup-textarea min-h-[64px] text-[12px]"
              rows={3}
              value={draft.customInstruction}
              placeholder={t("options.enhancement.customInstructionPlaceholder")}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  customInstruction: e.target.value,
                }))
              }
            />
            <p className="mt-1 text-[10px] text-text-muted">
              {t("options.enhancement.customInstructionHint")}
            </p>
          </div>
        </section>
      </div>

      <div className="border-t border-border bg-bg-raised px-3 py-2">
        <button
          type="button"
          className="pup-btn-primary w-full !py-1.5 text-xs"
          onClick={handleSave}
          disabled={!isDirty}
        >
          <SparkIcon width={12} height={12} />
          {t("options.provider.save")}
        </button>
      </div>
    </div>
  );
}
