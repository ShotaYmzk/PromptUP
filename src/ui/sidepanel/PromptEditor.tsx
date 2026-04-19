import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/Modal";
import { PinIcon } from "@/components/Icon";
import { Folder, Prompt } from "@/lib/types";
import { extractVariables } from "@/lib/prompt-vars";

interface PromptEditorProps {
  open: boolean;
  onClose: () => void;
  onSave: (
    draft: {
      title: string;
      body: string;
      description?: string;
      tags: string[];
      folderId: string | null;
    },
    existingId?: string,
  ) => Promise<void>;
  folders: Folder[];
  editing?: Prompt | null;
  initialFolderId?: string | null;
  /** Whether the prompt currently being edited is pinned. */
  pinned?: boolean;
  /** Invoked when the pin button in the editor header is clicked. */
  onTogglePin?: (prompt: Prompt) => void;
}

export function PromptEditor({
  open,
  onClose,
  onSave,
  folders,
  editing,
  initialFolderId = null,
  pinned = false,
  onTogglePin,
}: PromptEditorProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [folderId, setFolderId] = useState<string | null>(initialFolderId);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSaving(false);
    if (editing) {
      setTitle(editing.title);
      setBody(editing.body);
      setDescription(editing.description ?? "");
      setTagsInput(editing.tags.join(", "));
      setFolderId(editing.folderId);
    } else {
      setTitle("");
      setBody("");
      setDescription("");
      setTagsInput("");
      setFolderId(initialFolderId);
    }
  }, [open, editing, initialFolderId]);

  const variables = useMemo(() => extractVariables(body), [body]);

  async function handleSubmit() {
    if (!title.trim()) return setError(t("prompt.errors.titleRequired"));
    if (!body.trim()) return setError(t("prompt.errors.bodyRequired"));
    if (title.length > 100) return setError(t("prompt.errors.titleTooLong"));
    if (body.length > 10_000) return setError(t("prompt.errors.bodyTooLong"));
    if (description.length > 300)
      return setError(t("prompt.errors.descriptionTooLong"));

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20);

    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(),
          body,
          description: description.trim() || undefined,
          tags,
          folderId,
        },
        editing?.id,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? t("common.edit") : t("library.newPrompt")}
      widthClass="max-w-lg"
      headerAction={
        editing && onTogglePin ? (
          <button
            type="button"
            className={[
              "pup-btn-ghost h-8 w-8 !p-0",
              pinned ? "text-warn" : "text-text-muted",
            ].join(" ")}
            title={pinned ? t("pins.unpin") : t("pins.pin")}
            aria-label={pinned ? t("pins.unpin") : t("pins.pin")}
            aria-pressed={pinned}
            onClick={() => onTogglePin(editing)}
          >
            <PinIcon width={16} height={16} />
          </button>
        ) : undefined
      }
      footer={
        <>
          <button type="button" className="pup-btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="pup-btn-primary"
            disabled={saving}
            onClick={handleSubmit}
          >
            {t("common.save")}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {error && (
          <div className="rounded-md border border-[rgba(248,113,113,0.4)] bg-[rgba(248,113,113,0.1)] px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}
        <div>
          <label className="pup-label" htmlFor="prompt-title">
            {t("prompt.title")}
          </label>
          <input
            id="prompt-title"
            className="pup-input"
            value={title}
            maxLength={100}
            placeholder={t("prompt.titlePlaceholder")}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="pup-label" htmlFor="prompt-body">
            {t("prompt.body")}
          </label>
          <textarea
            id="prompt-body"
            className="pup-textarea"
            rows={8}
            value={body}
            maxLength={10_000}
            placeholder={t("prompt.bodyPlaceholder")}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="mt-1 flex items-center justify-between text-xs text-text-muted">
            <span>
              {variables.length > 0
                ? `${t("prompt.variablesDetected")}: ${variables.join(", ")}`
                : t("prompt.noVariables")}
            </span>
            <span>{body.length} / 10,000</span>
          </div>
        </div>
        <div>
          <label className="pup-label" htmlFor="prompt-desc">
            {t("prompt.description")}
          </label>
          <input
            id="prompt-desc"
            className="pup-input"
            value={description}
            maxLength={300}
            placeholder={t("prompt.descriptionPlaceholder")}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pup-label" htmlFor="prompt-tags">
              {t("prompt.tags")}
            </label>
            <input
              id="prompt-tags"
              className="pup-input"
              value={tagsInput}
              placeholder={t("prompt.tagsPlaceholder")}
              onChange={(e) => setTagsInput(e.target.value)}
            />
          </div>
          <div>
            <label className="pup-label" htmlFor="prompt-folder">
              {t("prompt.folder")}
            </label>
            <select
              id="prompt-folder"
              className="pup-input"
              value={folderId ?? ""}
              onChange={(e) => setFolderId(e.target.value || null)}
            >
              <option value="">{t("library.uncategorized")}</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
