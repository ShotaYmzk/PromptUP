import { loadSettings } from "@/lib/storage";
import {
  buildEnhanceUserPrompt,
  DEFAULT_ENHANCE_SYSTEM_PROMPT,
  DEFAULT_ENHANCE_USER_PROMPT_PREFIX,
} from "@/lib/enhancePrompt";
import type {
  EnhanceErrorCode,
  EnhanceRequest,
  EnhanceResponse,
  RuntimeMessage,
} from "@/lib/types";
import { enhanceWithOpenAI } from "./providers/openai";
import { enhanceWithAnthropic } from "./providers/anthropic";
import { enhanceWithGemini } from "./providers/gemini";
import { ProviderError } from "./providers/types";

const TIMEOUT_MS = 30_000;

chrome.runtime.onInstalled.addListener(() => {
  // Allow opening the side panel via the action button in addition to the popup.
  chrome.sidePanel
    ?.setPanelBehavior?.({ openPanelOnActionClick: false })
    .catch(() => undefined);
});

chrome.commands?.onCommand.addListener(async (command) => {
  if (command === "open-sidepanel") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.windowId !== undefined) {
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
      } catch {
        // ignore
      }
    }
  } else if (command === "open-quick-search") {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (tab?.id !== undefined) {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: "OPEN_QUICK_SEARCH" });
      } catch {
        // Content script may not be present on this page.
      }
    }
  }
});

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;

    if (message.type === "ENHANCE_PROMPT") {
      handleEnhance(message).then(sendResponse).catch((error) => {
        sendResponse({
          ok: false,
          error: "UNKNOWN",
          message: (error as Error)?.message ?? "Unknown error",
        } satisfies EnhanceResponse);
      });
      return true;
    }

    if (message.type === "OPEN_SIDE_PANEL") {
      // IMPORTANT: Chrome requires chrome.sidePanel.open() to be called in a
      // user-gesture context. When this message originates from a content-script
      // click, the gesture is forwarded to the service worker, but ANY `await`
      // before sidePanel.open() will drop the gesture and the API silently
      // fails. So we branch synchronously on `sender.tab`, and only fall back
      // to `tabs.query` when there is no sender tab (popup / options page).
      const senderWindowId = sender?.tab?.windowId;
      if (senderWindowId !== undefined) {
        chrome.sidePanel
          .open({ windowId: senderWindowId })
          .then(() => sendResponse({ ok: true }))
          .catch((error: Error) =>
            sendResponse({ ok: false, error: error?.message ?? "open failed" }),
          );
        return true;
      }
      chrome.tabs
        .query({ active: true, currentWindow: true })
        .then(async ([tab]) => {
          if (tab?.windowId === undefined) {
            sendResponse({ ok: false, error: "no active window" });
            return;
          }
          try {
            await chrome.sidePanel.open({ windowId: tab.windowId });
            sendResponse({ ok: true });
          } catch (error) {
            sendResponse({
              ok: false,
              error: (error as Error)?.message ?? "open failed",
            });
          }
        });
      return true;
    }

    return false;
  },
);

async function handleEnhance(req: EnhanceRequest): Promise<EnhanceResponse> {
  const text = (req.text ?? "").trim();
  if (!text) return errResponse("EMPTY_INPUT");

  const settings = await loadSettings();
  const provider = settings.activeProvider;
  const config = settings.providers[provider];
  if (!config?.apiKey) return errResponse("NO_API_KEY");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const baseSystemPrompt =
    settings.enhanceSystemPrompt?.trim() || DEFAULT_ENHANCE_SYSTEM_PROMPT;
  const userPromptPrefix =
    settings.enhanceUserPromptPrefix?.trim() ||
    DEFAULT_ENHANCE_USER_PROMPT_PREFIX;

  const systemPrompt = [
    baseSystemPrompt,
    settings.customInstruction?.trim(),
    req.overrides?.systemPromptOverride?.trim(),
  ]
    .filter(Boolean)
    .join("\n\n");

  const overrideModel = req.overrides?.model?.trim();
  const model = overrideModel ? overrideModel : config.model;

  try {
    let enhanced: string;
    const baseArgs = {
      apiKey: config.apiKey,
      model,
      systemPrompt,
      userPrompt: buildEnhanceUserPrompt(text, userPromptPrefix),
      signal: controller.signal,
      temperature: req.overrides?.temperature,
    };
    if (provider === "openai") {
      enhanced = await enhanceWithOpenAI(baseArgs);
    } else if (provider === "anthropic") {
      enhanced = await enhanceWithAnthropic(baseArgs);
    } else {
      enhanced = await enhanceWithGemini(baseArgs);
    }
    return { ok: true, text: sanitizeEnhanced(enhanced) };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      return errResponse("TIMEOUT");
    }
    if (error instanceof ProviderError) {
      return errResponse(error.code, error.message);
    }
    if (error instanceof TypeError) {
      return errResponse("NETWORK", error.message);
    }
    return errResponse("UNKNOWN", (error as Error)?.message);
  } finally {
    clearTimeout(timer);
  }
}

function errResponse(code: EnhanceErrorCode, message?: string): EnhanceResponse {
  return { ok: false, error: code, message };
}

/**
 * Defensive cleanup: even with strict instructions, models sometimes wrap
 * output in <prompt> tags, quote marks, or a leading "Improved prompt:" label.
 * Strip those so the text inserted back into the composer is clean.
 */
function sanitizeEnhanced(text: string): string {
  let out = text.trim();
  if (!out) return out;

  out = out.replace(/^<\s*prompt\s*>\s*/i, "").replace(/\s*<\s*\/\s*prompt\s*>\s*$/i, "").trim();

  out = out.replace(
    /^(?:improved prompt|rewritten prompt|enhanced prompt|改善されたプロンプト|改善後のプロンプト|書き直したプロンプト)\s*[:：\-]\s*/i,
    "",
  );

  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["「", "」"],
    ["『", "』"],
    ["“", "”"],
    ["```", "```"],
  ];
  for (const [open, close] of pairs) {
    if (out.startsWith(open) && out.endsWith(close) && out.length > open.length + close.length) {
      out = out.slice(open.length, out.length - close.length).trim();
      break;
    }
  }

  return out;
}
