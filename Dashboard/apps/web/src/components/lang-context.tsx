"use client";

import { t as translate, type Lang, type UiKey } from "@rp/core";
import { createContext, useContext, useEffect } from "react";

const LangContext = createContext<Lang>("sv");

/** Språket för det kunden ser (delade länkar, PDF). Appen är på svenska. */
export function LangProvider({ lang, document: setDocument, children }: { lang: Lang; /** Sätt även sidans lang-attribut (kundvyer). */ document?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    if (setDocument) window.document.documentElement.lang = lang;
  }, [lang, setDocument]);
  return <LangContext.Provider value={lang}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** Text på aktuellt språk. */
export function useT() {
  const lang = useLang();
  return (key: UiKey) => translate(lang, key);
}
