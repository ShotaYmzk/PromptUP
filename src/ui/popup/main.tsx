import React from "react";
import ReactDOM from "react-dom/client";
import "@/styles/globals.css";
import { initI18n } from "@/i18n";
import { SettingsProvider } from "@/context/SettingsContext";
import { LibraryProvider } from "@/context/LibraryContext";
import { ToastProvider } from "@/components/Toast";
import { PopupApp } from "./App";

async function bootstrap() {
  await initI18n("auto");
  const root = document.getElementById("root")!;
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <SettingsProvider>
        <LibraryProvider>
          <ToastProvider>
            <PopupApp />
          </ToastProvider>
        </LibraryProvider>
      </SettingsProvider>
    </React.StrictMode>,
  );
}

void bootstrap();
