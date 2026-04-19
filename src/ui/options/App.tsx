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
import { SparkIcon } from "@/components/Icon";

const PROVIDER_META: Array<{
  id: ProviderId;
  labelKey: string;
  docs: string;
  keyHint: string;
}> = [
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

export function OptionsApp() {
  const { settings, loading, replace } = useSettings();
  const { notify } = useToast();
  const { t } = useTranslation();

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

  const activeProvider = draft.activeProvider;
  const activeConfig = draft.providers[activeProvider];

  async function handleSave() {
    await replace(draft);
    notify(t("options.provider.saved"), "success");
  }

  function updateProvider(id: ProviderId, patch: Partial<Settings["providers"][ProviderId]>) {
    setDraft((prev) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [id]: { ...prev.providers[id], ...patch },
      },
    }));
  }

  if (loading) {
    return <div className="p-8 text-text-muted">{t("common.loading")}</div>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-bg-raised">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-brand-fg">
            <SparkIcon width={20} height={20} />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t("options.title")}</h1>
            <p className="text-sm text-text-muted">{t("app.tagline")}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-8">
        <section className="pup-section space-y-5">
          <h2 className="text-base font-semibold">
            {t("options.sections.provider")}
          </h2>

          <div>
            <label className="pup-label" htmlFor="provider-select">
              {t("options.provider.label")}
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {PROVIDER_META.map((meta) => (
                <button
                  key={meta.id}
                  type="button"
                  onClick={() =>
                    setDraft((prev) => ({ ...prev, activeProvider: meta.id }))
                  }
                  className={[
                    "rounded-lg border px-3 py-3 text-sm font-medium text-left transition-colors",
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
          </div>

          {PROVIDER_META.map((meta) => (
            <div
              key={meta.id}
              className={[
                "rounded-lg border border-border p-4 space-y-3",
                meta.id === draft.activeProvider
                  ? "bg-surface-muted"
                  : "bg-transparent opacity-80",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{t(meta.labelKey)}</div>
                <a
                  href={meta.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-brand hover:underline"
                >
                  {meta.docs.replace("https://", "")}
                </a>
              </div>
              <div>
                <label className="pup-label" htmlFor={`apikey-${meta.id}`}>
                  {t("options.provider.apiKey")}
                </label>
                <div className="flex gap-2">
                  <input
                    id={`apikey-${meta.id}`}
                    className="pup-input font-mono"
                    type={showKey[meta.id] ? "text" : "password"}
                    placeholder={meta.keyHint}
                    value={draft.providers[meta.id].apiKey}
                    onChange={(e) =>
                      updateProvider(meta.id, { apiKey: e.target.value })
                    }
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    className="pup-btn-secondary whitespace-nowrap"
                    onClick={() =>
                      setShowKey((prev) => ({ ...prev, [meta.id]: !prev[meta.id] }))
                    }
                  >
                    {showKey[meta.id]
                      ? t("options.provider.hideKey")
                      : t("options.provider.showKey")}
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {t("options.provider.apiKeyHint")}
                </p>
              </div>
              <div>
                <label className="pup-label" htmlFor={`model-${meta.id}`}>
                  {t("options.provider.model")}
                </label>
                <input
                  id={`model-${meta.id}`}
                  className="pup-input"
                  value={draft.providers[meta.id].model}
                  placeholder={DEFAULT_MODELS[meta.id]}
                  onChange={(e) =>
                    updateProvider(meta.id, { model: e.target.value })
                  }
                  spellCheck={false}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="pup-section space-y-4">
          <h2 className="text-base font-semibold">
            {t("options.sections.appearance")}
          </h2>
          <div>
            <span className="pup-label">{t("options.appearance.theme")}</span>
            <div className="inline-flex rounded-lg border border-border bg-bg-raised p-1">
              {(["dark", "light"] as ThemeMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  className={[
                    "px-3 py-1.5 text-sm rounded-md transition-colors",
                    draft.theme === mode
                      ? "bg-brand text-brand-fg"
                      : "text-text-muted hover:text-text",
                  ].join(" ")}
                  onClick={() => setDraft((prev) => ({ ...prev, theme: mode }))}
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
            <label className="pup-label" htmlFor="language-select">
              {t("options.appearance.language")}
            </label>
            <select
              id="language-select"
              className="pup-input"
              value={draft.language}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  language: e.target.value as LanguagePref,
                }))
              }
            >
              <option value="auto">{t("options.appearance.languageAuto")}</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
        </section>

        <section className="pup-section space-y-3">
          <h2 className="text-base font-semibold">
            {t("options.sections.enhancement")}
          </h2>
          <div>
            <label className="pup-label" htmlFor="enhance-system-prompt">
              {t("options.enhancement.systemPrompt")}
            </label>
            <textarea
              id="enhance-system-prompt"
              className="pup-textarea"
              rows={8}
              value={draft.enhanceSystemPrompt}
              placeholder={DEFAULT_ENHANCE_SYSTEM_PROMPT}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  enhanceSystemPrompt: e.target.value,
                }))
              }
            />
            <p className="mt-1 text-xs text-text-muted">
              {t("options.enhancement.systemPromptHint")}
            </p>
          </div>
          <div>
            <label className="pup-label" htmlFor="enhance-user-prefix">
              {t("options.enhancement.userPromptPrefix")}
            </label>
            <input
              id="enhance-user-prefix"
              className="pup-input"
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
            <p className="mt-1 text-xs text-text-muted">
              {t("options.enhancement.userPromptPrefixHint")}
            </p>
          </div>
          <div>
            <label className="pup-label" htmlFor="custom-instruction">
              {t("options.enhancement.customInstruction")}
            </label>
            <textarea
              id="custom-instruction"
              className="pup-textarea"
              rows={4}
              value={draft.customInstruction}
              placeholder={t("options.enhancement.customInstructionPlaceholder")}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  customInstruction: e.target.value,
                }))
              }
            />
            <p className="mt-1 text-xs text-text-muted">
              {t("options.enhancement.customInstructionHint")}
            </p>
          </div>
          <div className="rounded-lg border border-border bg-surface-muted p-3 text-xs text-text-muted">
            <div className="mb-1 font-semibold text-text">
              {t("variables.preview")}
            </div>
            <div className="font-mono whitespace-pre-wrap">
              {(draft.enhanceSystemPrompt.trim() || DEFAULT_ENHANCE_SYSTEM_PROMPT) +
                "\n\n" +
                (draft.enhanceUserPromptPrefix.trim() ||
                  DEFAULT_ENHANCE_USER_PROMPT_PREFIX) +
                "\n\n<prompt>\n...\n</prompt>"}
              {draft.customInstruction.trim() ? `\n\n${draft.customInstruction.trim()}` : ""}
            </div>
          </div>
        </section>

        <div className="sticky bottom-4 z-10 flex justify-end">
          <button
            type="button"
            className="pup-btn-primary shadow-popup"
            onClick={handleSave}
            disabled={!isDirty}
          >
            <SparkIcon />
            {t("options.provider.save")}
          </button>
        </div>

        <footer className="py-4 text-center text-xs text-text-muted">
          PromptUP · API keys are stored locally on this device. Active provider:{" "}
          <strong className="text-text">
            {t(
              `options.provider.${activeProvider}` as
                | "options.provider.openai"
                | "options.provider.anthropic"
                | "options.provider.gemini",
            )}
          </strong>
          {activeConfig.apiKey ? "" : " · " + t("enhance.errors.NO_API_KEY")}
        </footer>
      </main>
    </div>
  );
}
