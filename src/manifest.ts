import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "../package.json" with { type: "json" };

export default defineManifest({
  manifest_version: 3,
  name: "__MSG_extensionName__",
  description: "__MSG_extensionDescription__",
  default_locale: "en",
  version: pkg.version,
  icons: {
    16: "public/icons/icon-16.png",
    32: "public/icons/icon-32.png",
    48: "public/icons/icon-48.png",
    128: "public/icons/icon-128.png",
  },
  action: {
    default_popup: "src/ui/popup/index.html",
    default_title: "PromptUP",
    default_icon: {
      16: "public/icons/icon-16.png",
      32: "public/icons/icon-32.png",
    },
  },
  side_panel: {
    default_path: "src/ui/sidepanel/index.html",
  },
  options_page: "src/ui/options/index.html",
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
      ],
      js: ["src/content/index.ts"],
      run_at: "document_idle",
    },
  ],
  permissions: ["storage", "sidePanel", "activeTab", "scripting"],
  host_permissions: [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
  ],
  commands: {
    "open-sidepanel": {
      suggested_key: {
        default: "Ctrl+Shift+U",
        mac: "Command+Shift+U",
      },
      description: "Open PromptUP side panel",
    },
    "open-quick-search": {
      suggested_key: {
        default: "Ctrl+Shift+P",
        mac: "Command+Shift+P",
      },
      description: "Open PromptUP quick search",
    },
  },
  web_accessible_resources: [
    {
      resources: ["public/icons/*"],
      matches: [
        "https://chatgpt.com/*",
        "https://chat.openai.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
      ],
    },
  ],
  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self';",
  },
});
