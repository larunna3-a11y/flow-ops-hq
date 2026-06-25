import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "./locales/en.json";
import id from "./locales/id.json";

export const LANGUAGES = [
  { code: "en", label: "English", short: "EN" },
  { code: "id", label: "Bahasa Indonesia", short: "ID" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "flowops-language";
const isBrowser = typeof window !== "undefined";

function readStoredLanguage(): LanguageCode {
  if (!isBrowser) return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "id") return stored;
    const nav = window.navigator?.language?.slice(0, 2).toLowerCase();
    if (nav === "id") return "id";
  } catch {
    /* ignore */
  }
  return "en";
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      id: { translation: id },
    },
    lng: readStoredLanguage(),
    fallbackLng: "en",
    supportedLngs: ["en", "id"],
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    returnNull: false,
  });
}

export function setLanguage(lng: LanguageCode) {
  void i18n.changeLanguage(lng);
  if (isBrowser) {
    try {
      window.localStorage.setItem(STORAGE_KEY, lng);
    } catch {
      /* ignore */
    }
  }
}

export default i18n;
