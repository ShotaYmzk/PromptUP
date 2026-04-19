import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/Modal";
import { PinnedSettings, Prompt, TargetService } from "@/lib/types";

interface PinSettingsDialogProps {
  open: boolean;
  prompt: Prompt | null;
  initialSettings?: PinnedSettings;
  onClose: () => void;
  onSave: (settings: PinnedSettings | undefined) => Promise<void> | void;
}

interface FormState {
  modelOverride: string;
  temperatureEnabled: boolean;
  temperature: number;
  systemPromptOverride: string;
  targetService: TargetService;
}

const DEFAULT_FORM: FormState = {
  modelOverride: "",
  temperatureEnabled: false,
  temperature: 0.5,
  systemPromptOverride: "",
  targetService: "auto",
};

function toForm(settings?: PinnedSettings): FormState {
  if (!settings) return DEFAULT_FORM;
  return {
    modelOverride: settings.modelOverride ?? "",
    temperatureEnabled: typeof settings.temperature === "number",
    temperature:
      typeof settings.temperature === "number" ? settings.temperature : 0.5,
    systemPromptOverride: settings.systemPromptOverride ?? "",
    targetService: settings.targetService ?? "auto",
  };
}

function toSettings(form: FormState): PinnedSettings | undefined {
  const out: PinnedSettings = {};
  if (form.modelOverride.trim()) {
    out.modelOverride = form.modelOverride.trim();
  }
  if (form.temperatureEnabled) {
    out.temperature = form.temperature;
  }
  if (form.systemPromptOverride.trim()) {
    out.systemPromptOverride = form.systemPromptOverride.trim();
  }
  if (form.targetService !== "auto") {
    out.targetService = form.targetService;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function PinSettingsDialog({
  open,
  prompt,
  initialSettings,
  onClose,
  onSave,
}: PinSettingsDialogProps) {
  const { t } = useTranslation();
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(toForm(initialSettings));
  }, [open, initialSettings]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(toSettings(form));
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      await onSave(undefined);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${t("pins.pinSettings.title")}${
        prompt ? ` — ${prompt.title}` : ""
      }`}
      widthClass="max-w-lg"
      footer={
        <>
          <button
            type="button"
            className="pup-btn-ghost mr-auto text-danger"
            onClick={handleReset}
            disabled={saving || !initialSettings}
          >
            {t("pins.pinSettings.reset")}
          </button>
          <button type="button" className="pup-btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="pup-btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-[11px] text-text-muted">
          {t("pins.pinSettings.description")}
        </p>

        <div>
          <label className="pup-label" htmlFor="pin-model">
            {t("pins.pinSettings.modelOverride")}
          </label>
          <input
            id="pin-model"
            className="pup-input"
            value={form.modelOverride}
            placeholder={t("pins.pinSettings.modelOverridePlaceholder")}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, modelOverride: e.target.value }))
            }
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="pup-label !mb-0" htmlFor="pin-temperature">
              {t("pins.pinSettings.temperature")}
            </label>
            <label className="flex items-center gap-1.5 text-[11px] text-text-muted">
              <input
                type="checkbox"
                checked={form.temperatureEnabled}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    temperatureEnabled: e.target.checked,
                  }))
                }
              />
              {form.temperatureEnabled ? form.temperature.toFixed(2) : "—"}
            </label>
          </div>
          <input
            id="pin-temperature"
            type="range"
            min={0}
            max={2}
            step={0.05}
            className="mt-2 w-full accent-brand"
            value={form.temperature}
            disabled={!form.temperatureEnabled}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                temperature: Number(e.target.value),
              }))
            }
          />
          <p className="mt-1 text-[11px] text-text-muted">
            {t("pins.pinSettings.temperatureHint")}
          </p>
        </div>

        <div>
          <label className="pup-label" htmlFor="pin-system">
            {t("pins.pinSettings.systemPromptOverride")}
          </label>
          <textarea
            id="pin-system"
            className="pup-textarea"
            rows={4}
            maxLength={2000}
            value={form.systemPromptOverride}
            placeholder={t("pins.pinSettings.systemPromptPlaceholder")}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                systemPromptOverride: e.target.value,
              }))
            }
          />
        </div>

        <div>
          <label className="pup-label" htmlFor="pin-target">
            {t("pins.pinSettings.targetService")}
          </label>
          <select
            id="pin-target"
            className="pup-input"
            value={form.targetService}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                targetService: e.target.value as TargetService,
              }))
            }
          >
            <option value="auto">
              {t("pins.pinSettings.targetServiceAuto")}
            </option>
            <option value="chatgpt">
              {t("pins.pinSettings.targetServiceChatgpt")}
            </option>
            <option value="claude">
              {t("pins.pinSettings.targetServiceClaude")}
            </option>
            <option value="gemini">
              {t("pins.pinSettings.targetServiceGemini")}
            </option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
