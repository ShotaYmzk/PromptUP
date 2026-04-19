import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ja from "./locales/ja.json";
import type { LanguagePref } from "@/lib/types";

export const SUPPORTED_LANGUAGES = ["en", "ja"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = {
  en: { translation: en },
  ja: { translation: ja },
} as const;

let initialized = false;

export async function initI18n(pref: LanguagePref = "auto"): Promise<void> {
  if (initialized) {
    await applyLanguagePref(pref);
    return;
  }
  initialized = true;

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "en",
      supportedLngs: SUPPORTED_LANGUAGES as unknown as string[],
      nonExplicitSupportedLngs: true,
      interpolation: { escapeValue: false },
      detection: {
        order: ["navigator", "htmlTag"],
        caches: [],
      },
      react: {
        useSuspense: false,
      },
    });

  await applyLanguagePref(pref);
}

export async function applyLanguagePref(pref: LanguagePref): Promise<void> {
  if (pref === "auto") {
    const detected = (navigator.language || "en").slice(0, 2);
    const lang = (SUPPORTED_LANGUAGES as readonly string[]).includes(detected)
      ? detected
      : "en";
    await i18n.changeLanguage(lang);
    return;
  }
  await i18n.changeLanguage(pref);
}

export default i18n;
