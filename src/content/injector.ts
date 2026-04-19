export type TargetKind = "textarea" | "contenteditable";

export interface TargetAdapter {
  readonly host: string;
  readonly selector: string;
  readonly sendButtonSelector: string;
  readonly kind: TargetKind;
  /** Horizontal gap in pixels between PromptUP button and the send button. */
  readonly gap: number;
  /** Optional tone hint for site-specific color tuning. */
  readonly tone: "chatgpt" | "claude" | "gemini";
  getValue: (el: HTMLElement) => string;
  setValue: (el: HTMLElement, value: string) => void;
}

function readValue(el: HTMLElement): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) {
    return el.value;
  }
  return el.innerText;
}

function writeTextarea(el: HTMLTextAreaElement | HTMLInputElement, value: string): void {
  const proto = Object.getPrototypeOf(el);
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) {
    setter.call(el, value);
  } else {
    el.value = value;
  }
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function writeContentEditable(el: HTMLElement, value: string): void {
  el.focus();
  const selection = window.getSelection();
  if (!selection) {
    el.textContent = value;
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    return;
  }
  const range = document.createRange();
  range.selectNodeContents(el);
  selection.removeAllRanges();
  selection.addRange(range);
  try {
    document.execCommand("selectAll", false, undefined);
    document.execCommand("insertText", false, value);
  } catch {
    el.textContent = value;
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true }));
}

const chatgpt: TargetAdapter = {
  host: "chatgpt.com",
  selector:
    '#prompt-textarea, textarea[data-id="prompt-textarea"], div[contenteditable="true"][id="prompt-textarea"]',
  sendButtonSelector: [
    "#composer-submit-btn",
    'button[data-testid="send-button"]',
    'button[data-testid="composer-send-button"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="送信"]',
  ].join(", "),
  kind: "contenteditable",
  gap: 8,
  tone: "chatgpt",
  getValue: readValue,
  setValue: (el, value) => {
    if (el instanceof HTMLTextAreaElement) {
      writeTextarea(el, value);
    } else {
      writeContentEditable(el, value);
    }
  },
};

const claude: TargetAdapter = {
  host: "claude.ai",
  selector:
    'div[contenteditable="true"].ProseMirror, div[contenteditable="true"]',
  sendButtonSelector: [
    'button[aria-label="Send message"]',
    'button[aria-label="Send Message"]',
    'button[aria-label="メッセージを送信"]',
    'button[aria-label*="Send"]',
    'button[aria-label*="送信"]',
    'fieldset button[type="button"][aria-label]',
  ].join(", "),
  kind: "contenteditable",
  gap: 8,
  tone: "claude",
  getValue: readValue,
  setValue: (el, value) => writeContentEditable(el, value),
};

const gemini: TargetAdapter = {
  host: "gemini.google.com",
  selector: "rich-textarea .ql-editor, .ql-editor",
  sendButtonSelector: [
    "button.send-button",
    'button[aria-label*="Send"]',
    'button[aria-label*="送信"]',
    'button[mat-icon-button][aria-label]',
  ].join(", "),
  kind: "contenteditable",
  gap: 8,
  tone: "gemini",
  getValue: readValue,
  setValue: (el, value) => writeContentEditable(el, value),
};

export function resolveAdapter(): TargetAdapter | null {
  const host = location.hostname;
  if (host.endsWith("chatgpt.com")) return chatgpt;
  if (host.endsWith("claude.ai")) return claude;
  if (host.endsWith("gemini.google.com")) return gemini;
  return null;
}

export function findTarget(adapter: TargetAdapter): HTMLElement | null {
  const nodes = document.querySelectorAll<HTMLElement>(adapter.selector);
  if (nodes.length === 0) return null;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node.offsetParent !== null || node === document.activeElement) {
      return node;
    }
  }
  return nodes[nodes.length - 1];
}

/**
 * Find the site's native send button that sits next to the composer.
 * Prefers buttons that are currently on-screen and near the given target.
 */
export function findSendButton(
  adapter: TargetAdapter,
  target: HTMLElement | null,
): HTMLElement | null {
  const candidates = Array.from(
    document.querySelectorAll<HTMLElement>(adapter.sendButtonSelector),
  ).filter((el) => el.offsetParent !== null && el.getBoundingClientRect().width > 0);
  if (candidates.length === 0) return null;
  if (!target) return candidates[candidates.length - 1];

  const targetRect = target.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const rect = candidate.getBoundingClientRect();
    const dx = rect.left - targetRect.right;
    const dy = rect.top - targetRect.top;
    // Prefer buttons close to the composer in both axes.
    const score = Math.abs(dx) + Math.abs(dy) * 2;
    if (score < bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best ?? candidates[candidates.length - 1];
}
