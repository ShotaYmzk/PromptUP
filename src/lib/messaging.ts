import type {
  EnhanceOverrides,
  EnhanceRequest,
  EnhanceResponse,
  RuntimeMessage,
} from "./types";

export async function sendEnhanceRequest(
  text: string,
  overrides?: EnhanceOverrides,
): Promise<EnhanceResponse> {
  const message: EnhanceRequest = overrides
    ? { type: "ENHANCE_PROMPT", text, overrides }
    : { type: "ENHANCE_PROMPT", text };
  try {
    const response = (await chrome.runtime.sendMessage(
      message,
    )) as EnhanceResponse | undefined;
    if (!response) {
      return {
        ok: false,
        error: "UNKNOWN",
        message: "No response from background worker",
      };
    }
    return response;
  } catch (error) {
    return {
      ok: false,
      error: "UNKNOWN",
      message: (error as Error)?.message ?? "Message failed",
    };
  }
}

export async function openSidePanel(): Promise<void> {
  try {
    const msg: RuntimeMessage = { type: "OPEN_SIDE_PANEL" };
    await chrome.runtime.sendMessage(msg);
  } catch {
    // ignore
  }
}

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
