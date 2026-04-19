import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_SETTINGS,
  Settings,
} from "@/lib/types";
import { loadSettings, saveSettings, subscribeStorage } from "@/lib/storage";
import { applyLanguagePref } from "@/i18n";

interface SettingsContextValue {
  settings: Settings;
  loading: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
  replace: (next: Settings) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    loadSettings().then((initial) => {
      if (!mounted) return;
      setSettings(initial);
      setLoading(false);
      applyTheme(initial.theme);
      void applyLanguagePref(initial.language);
    });
    const unsub = subscribeStorage((changes) => {
      if (changes.settings) {
        setSettings(changes.settings);
        applyTheme(changes.settings.theme);
        void applyLanguagePref(changes.settings.language);
      }
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const replace = useCallback(async (next: Settings) => {
    setSettings(next);
    applyTheme(next.theme);
    await applyLanguagePref(next.language);
    await saveSettings(next);
  }, []);

  const update = useCallback(
    async (patch: Partial<Settings>) => {
      const next: Settings = { ...settings, ...patch };
      await replace(next);
    },
    [settings, replace],
  );

  const value = useMemo<SettingsContextValue>(
    () => ({ settings, loading, update, replace }),
    [settings, loading, update, replace],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

function applyTheme(theme: Settings["theme"]) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}
