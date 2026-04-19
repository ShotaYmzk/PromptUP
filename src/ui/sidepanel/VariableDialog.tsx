import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "@/components/Modal";
import { fillVariables } from "@/lib/prompt-vars";

interface VariableDialogProps {
  open: boolean;
  onClose: () => void;
  body: string;
  variables: string[];
  onSubmit: (filled: string) => void;
}

export function VariableDialog({
  open,
  onClose,
  body,
  variables,
  onSubmit,
}: VariableDialogProps) {
  const { t } = useTranslation();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      for (const name of variables) initial[name] = "";
      setValues(initial);
    }
  }, [open, variables]);

  const preview = useMemo(() => fillVariables(body, values), [body, values]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("variables.dialogTitle")}
      widthClass="max-w-md"
      footer={
        <>
          <button type="button" className="pup-btn-ghost" onClick={onClose}>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            className="pup-btn-primary"
            onClick={() => {
              onSubmit(preview);
              onClose();
            }}
          >
            {t("variables.insert")}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {variables.map((name) => (
          <div key={name}>
            <label className="pup-label" htmlFor={`var-${name}`}>
              {name}
            </label>
            <input
              id={`var-${name}`}
              className="pup-input"
              value={values[name] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [name]: e.target.value }))
              }
            />
          </div>
        ))}
        <div className="rounded-md border border-border bg-surface-muted p-3">
          <div className="pup-label">{t("variables.preview")}</div>
          <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-text">
            {preview}
          </pre>
        </div>
      </div>
    </Modal>
  );
}
