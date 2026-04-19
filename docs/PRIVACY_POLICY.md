# Privacy Policy — PromptUP (Chrome Extension)

**Last updated:** April 19, 2026  

PromptUP (“the Extension”) is a Manifest V3 Chrome extension that helps you save, organize, and enhance prompts on supported AI chat sites. This policy describes how information is handled **on your device** and what is sent **when you choose to use AI features**.

The Extension is developed as open-source software. **PromptUP does not operate its own backend servers** and does **not** collect your data on developer-controlled infrastructure for analytics, advertising, or profiling.

---

## 1. Data the developer does not collect

The Extension does **not**:

- Send your saved prompt library, folders, or settings to the developer  
- Run developer-controlled analytics or crash reporting that identifies you  
- Sell or rent your personal information  

---

## 2. Data stored locally on your device

The Extension stores the following **only in your browser** using `chrome.storage.local` (and related extension storage APIs):

- Saved prompts, folders, tags, pins, and usage metadata you create  
- Extension settings (theme, language, enhancement instructions, active provider, model selections)  
- API keys and model identifiers you enter for third-party AI providers  

API keys are stored with **lightweight obfuscation** in storage. Browser extension storage is **not** a substitute for a hardware security module or full-disk encryption—protect your device and your Chrome profile accordingly.

---

## 3. Data sent when you use “Enhance” (AI providers)

When you click the enhance action, the Extension sends **network requests from your browser** to the **third-party AI provider you configured** (for example OpenAI, Anthropic, or Google Gemini), so that provider can return an improved prompt.

Those requests may include:

- The prompt text you are enhancing  
- Your API key or equivalent credential **as required by that provider’s API**  
- Model and generation parameters needed to complete the request  

Those requests go **directly to the provider’s API endpoints**, not to PromptUP. Each provider processes data under **its own terms and privacy policy**. You should review:

- [OpenAI](https://openai.com/policies/)  
- [Anthropic](https://www.anthropic.com/legal/privacy)  
- [Google AI / Gemini](https://policies.google.com/privacy)  

PromptUP cannot control how a provider handles data once it leaves your browser.

---

## 4. Data sent when you visit supported websites

The Extension includes **content scripts** that run only on the host patterns declared in its manifest (for example ChatGPT, Claude, and Gemini web apps) to show the enhance UI and insert text into the page’s composer **when you use the Extension’s features**.

The Extension does **not** silently exfiltrate full page contents to the developer. Normal operation focuses on the chat composer and actions you initiate.

---

## 5. Permissions (why they exist)

The Extension requests Chrome permissions needed for its documented features—for example:

- **storage** — persist your library and settings locally  
- **sidePanel** — show the library in Chrome’s side panel  
- **activeTab** — coordinate actions with the currently active tab in user-initiated flows (e.g., popup, shortcuts)  
- **Host permissions** — run on supported AI sites and call the AI provider APIs you select when you use Enhance  

Exact patterns are defined in the Extension’s `manifest.json` in this repository.

---

## 6. Children’s privacy

The Extension is not directed at children under 13 (or the minimum age in your jurisdiction). If you are a parent or guardian and believe a child has provided information through misuse of the Extension, discontinue use and contact the relevant AI provider regarding data processed by that service.

---

## 7. Changes to this policy

This policy may be updated when the Extension’s behavior or legal requirements change. The **“Last updated”** date at the top will be revised. Continued use after changes means you accept the updated policy.

---

## 8. Open source and contact

Source code: see this GitHub repository.  

For privacy questions about **this Extension’s code and behavior**, open an issue on GitHub or contact the repository maintainer.  

For questions about data processed by **OpenAI, Anthropic, or Google**, contact those companies directly.

---

## 日本語（概要）

PromptUP はブラウザ上で動作する Chrome 拡張機能であり、**開発者用の独自サーバーにユーザーデータを収集・保存する仕組みはありません**。プロンプトライブラリや設定、APIキーは **`chrome.storage.local` に端末内保存**されます。  

「強化（Enhance）」機能利用時は、**ユーザーが選択した AI プロバイダ（OpenAI / Anthropic / Google Gemini 等）の API** に、ブラウザから直接リクエストが送られます（プロンプト本文・APIキー等）。その取り扱いは**各プロバイダのプライバシーポリシー**に従います。  

詳細は上記英語本文をご参照ください。
