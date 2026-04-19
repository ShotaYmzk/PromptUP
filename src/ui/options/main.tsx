import React from "react";
import ReactDOM from "react-dom/client";
import "@/styles/globals.css";
import { initI18n } from "@/i18n";
import { SettingsProvider } from "@/context/SettingsContext";
import { ToastProvider } from "@/components/Toast";
import { OptionsApp } from "./App";

async function bootstrap() {
  await initI18n("auto");
  const root = document.getElementById("root")!;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SettingsProvider>
        <ToastProvider>
          <OptionsApp />
        </ToastProvider>
      </SettingsProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
