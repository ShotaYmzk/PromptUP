import type {
  EnhanceOverrides,
  EnhanceRequest,
  EnhanceResponse,
  RuntimeMessage,
} from "./types";

const RUNTIME_TIMEOUT_MS = 30_000;
const INACTIVE_WORKER_ERROR_PATTERNS = [
  "Could not establish connection",
  "Receiving end does not exist",
  "Extension context invalidated",
];

async function sendRuntimeMessageWithTimeout<T>(message: RuntimeMessage): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Background worker timeout (30s)"));
    }, RUNTIME_TIMEOUT_MS);
  });
  try {
    return (await Promise.race([
      chrome.runtime.sendMessage(message) as Promise<T>,
      timeoutPromise,
    ])) as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function classifyRuntimeError(error: unknown): string {
  const msg = (error as Error)?.message ?? "";
  if (
    INACTIVE_WORKER_ERROR_PATTERNS.some((pattern) =>
      msg.toLowerCase().includes(pattern.toLowerCase()),
    )
  ) {
    return "Background worker is unavailable. Reload the extension tab and try again.";
  }
  return msg || "Message failed";
}

export async function sendEnhanceRequest(
  text: string,
  overrides?: EnhanceOverrides,
): Promise<EnhanceResponse> {
  const message: EnhanceRequest = overrides
    ? { type: "ENHANCE_PROMPT", text, overrides }
    : { type: "ENHANCE_PROMPT", text };
  try {
    const response = (await sendRuntimeMessageWithTimeout<EnhanceResponse | undefined>(
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
    const message = (error as Error)?.message ?? "";
    if (message.includes("timeout")) {
      return {
        ok: false,
        error: "TIMEOUT",
        message,
      };
    }
    return {
      ok: false,
      error: "UNKNOWN",
      message: classifyRuntimeError(error),
    };
  }
}

export async function openSidePanel(): Promise<void> {
  try {
    const msg: RuntimeMessage = { type: "OPEN_SIDE_PANEL" };
    await sendRuntimeMessageWithTimeout(msg);
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
