import { ReactNode, useEffect } from "react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  widthClass?: string;
  /** Rendered next to the close button; useful for actions tied to the dialog. */
  headerAction?: ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  widthClass = "max-w-md",
  headerAction,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-3"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full ${widthClass} rounded-xl border border-border bg-bg-raised shadow-popup flex flex-col max-h-[85vh]`}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">{title}</h2>
          <div className="flex items-center gap-1">
            {headerAction}
            <button
              type="button"
              className="pup-btn-ghost h-8 w-8 !p-0"
              onClick={onClose}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
        </div>
        <div className="px-4 py-4 overflow-y-auto">{children}</div>
        {footer && (
          <div className="px-4 py-3 border-t border-border flex items-center justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
