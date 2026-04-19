import { createContext, ReactNode, useCallback, useContext, useRef, useState } from "react";

type ToastTone = "info" | "success" | "error";

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastContextValue {
  notify: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const notify = useCallback<ToastContextValue["notify"]>(
    (message, tone = "info") => {
      idRef.current += 1;
      const id = idRef.current;
      setItems((prev) => [...prev, { id, message, tone }]);
      window.setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 3200);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            className={[
              "pointer-events-auto rounded-lg px-3 py-2 text-xs font-medium shadow-popup border",
              t.tone === "error"
                ? "bg-[rgba(248,113,113,0.15)] border-[rgba(248,113,113,0.4)] text-danger"
                : t.tone === "success"
                  ? "bg-[rgba(52,211,153,0.15)] border-[rgba(52,211,153,0.4)] text-success"
                  : "bg-bg-raised border-border text-text",
            ].join(" ")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
