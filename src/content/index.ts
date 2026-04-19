import { sendEnhanceRequest } from "@/lib/messaging";
import { loadSettings } from "@/lib/storage";
import { applyLanguagePref, initI18n } from "@/i18n";
import i18n from "@/i18n";
import {
  findSendButton,
  findTarget,
  resolveAdapter,
  TargetAdapter,
} from "./injector";
import styleText from "./styles.css?inline";

const HOST_ID = "promptup-injection-host";
const BUTTON_ID = "promptup-enhance-btn";
const LAUNCHER_ID = "promptup-launcher";
const LAUNCHER_PEEK_ID = "promptup-launcher-peek";
const LAUNCHER_DISMISS_KEY = "promptup:launcher-dismissed";

interface PanelElements {
  backdrop: HTMLDivElement;
  panel: HTMLDivElement;
  closeBtn: HTMLButtonElement;
  originalBody: HTMLDivElement;
  enhancedArea: HTMLTextAreaElement;
  loading: HTMLDivElement;
  error: HTMLDivElement;
  cancelBtn: HTMLButtonElement;
  regenBtn: HTMLButtonElement;
  acceptBtn: HTMLButtonElement;
  enhancedLabel: HTMLDivElement;
  enhancedHint: HTMLDivElement;
}

interface LauncherElements {
  launcher: HTMLButtonElement;
  launcherText: HTMLSpanElement;
  launcherClose: HTMLButtonElement;
  peek: HTMLButtonElement;
}

interface ContentState {
  adapter: TargetAdapter;
  shadowRoot: ShadowRoot;
  button: HTMLButtonElement;
  toast: HTMLDivElement;
  rootEl: HTMLDivElement;
  panelEls: PanelElements;
  launcherEls: LauncherElements;
  currentTarget: HTMLElement | null;
  currentSendBtn: HTMLElement | null;
  hideToastTimer?: number;
  buttonLoading: boolean;
  reviewOpen: boolean;
  reviewLoading: boolean;
  reviewOriginal: string;
  reviewEnhanced: string;
  launcherDismissed: boolean;
  /** Element whose margin-right we temporarily shifted to make room. */
  shiftedNeighbor: HTMLElement | null;
  shiftedAmountPx: number;
}

let state: ContentState | null = null;

function getTranslation(key: string, fallback: string): string {
  try {
    const value = i18n.t(key);
    if (typeof value === "string" && value && value !== key) return value;
  } catch {
    // ignore
  }
  return fallback;
}

function createPanel(shadow: ShadowRoot): PanelElements {
  const backdrop = document.createElement("div");
  backdrop.className = "promptup-backdrop";
  backdrop.setAttribute("data-visible", "false");

  const panel = document.createElement("div");
  panel.className = "promptup-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", getTranslation("review.title", "Enhance with PromptUP"));
  panel.setAttribute("data-visible", "false");

  panel.innerHTML = `
    <div class="promptup-panel-head">
      <div class="promptup-panel-title">
        <span class="promptup-panel-title-icon" aria-hidden="true">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" fill="currentColor"/>
            <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" fill="currentColor" opacity="0.75"/>
          </svg>
        </span>
        <span class="promptup-panel-title-text"></span>
      </div>
      <button type="button" class="promptup-panel-close" aria-label="Close">×</button>
    </div>
    <div class="promptup-panel-body">
      <div class="promptup-panel-section">
        <div class="promptup-panel-label promptup-panel-label-original"></div>
        <div class="promptup-panel-original"></div>
      </div>
      <div class="promptup-panel-section">
        <div class="promptup-panel-label promptup-panel-label-enhanced"></div>
        <div class="promptup-panel-loading" hidden>
          <span class="promptup-panel-spinner" aria-hidden="true"></span>
          <span class="promptup-panel-loading-text"></span>
        </div>
        <div class="promptup-panel-error" hidden></div>
        <textarea class="promptup-panel-enhanced" rows="10" spellcheck="false"></textarea>
        <div class="promptup-panel-hint"></div>
      </div>
    </div>
    <div class="promptup-panel-foot">
      <button type="button" class="promptup-panel-btn promptup-panel-btn-cancel"></button>
      <button type="button" class="promptup-panel-btn promptup-panel-btn-regen"></button>
      <button type="button" class="promptup-panel-btn promptup-panel-btn-accept"></button>
    </div>
  `;

  shadow.appendChild(backdrop);
  shadow.appendChild(panel);

  const q = <T extends Element>(sel: string) =>
    panel.querySelector<T>(sel) as T;

  return {
    backdrop,
    panel,
    closeBtn: q<HTMLButtonElement>(".promptup-panel-close"),
    originalBody: q<HTMLDivElement>(".promptup-panel-original"),
    enhancedArea: q<HTMLTextAreaElement>(".promptup-panel-enhanced"),
    loading: q<HTMLDivElement>(".promptup-panel-loading"),
    error: q<HTMLDivElement>(".promptup-panel-error"),
    cancelBtn: q<HTMLButtonElement>(".promptup-panel-btn-cancel"),
    regenBtn: q<HTMLButtonElement>(".promptup-panel-btn-regen"),
    acceptBtn: q<HTMLButtonElement>(".promptup-panel-btn-accept"),
    enhancedLabel: q<HTMLDivElement>(".promptup-panel-label-enhanced"),
    enhancedHint: q<HTMLDivElement>(".promptup-panel-hint"),
  };
}

function createLauncher(root: HTMLDivElement): LauncherElements {
  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.id = LAUNCHER_ID;
  launcher.className = "promptup-launcher";
  launcher.setAttribute("data-hidden", "false");
  launcher.innerHTML = `
    <span class="promptup-launcher-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" fill="currentColor"/>
      </svg>
    </span>
    <span class="promptup-launcher-text">PromptUP</span>
    <span class="promptup-launcher-close" role="button" tabindex="0">×</span>
  `;
  root.appendChild(launcher);

  const peek = document.createElement("button");
  peek.type = "button";
  peek.id = LAUNCHER_PEEK_ID;
  peek.className = "promptup-launcher-peek";
  peek.setAttribute("data-visible", "false");
  peek.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" fill="currentColor"/>
    </svg>
  `;
  root.appendChild(peek);

  return {
    launcher,
    launcherText: launcher.querySelector<HTMLSpanElement>(
      ".promptup-launcher-text",
    ) as HTMLSpanElement,
    launcherClose: launcher.querySelector<HTMLButtonElement>(
      ".promptup-launcher-close",
    ) as unknown as HTMLButtonElement,
    peek,
  };
}

function readLauncherDismissed(): boolean {
  try {
    return sessionStorage.getItem(LAUNCHER_DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLauncherDismissed(dismissed: boolean) {
  try {
    if (dismissed) {
      sessionStorage.setItem(LAUNCHER_DISMISS_KEY, "1");
    } else {
      sessionStorage.removeItem(LAUNCHER_DISMISS_KEY);
    }
  } catch {
    // ignore
  }
}

function refreshLauncherI18n(s: ContentState) {
  const label = getTranslation("app.name", "PromptUP");
  const tip = getTranslation("launcher.tooltip", "Open PromptUP library");
  const aria = getTranslation("launcher.ariaLabel", tip);
  s.launcherEls.launcherText.textContent = label;
  s.launcherEls.launcher.title = tip;
  s.launcherEls.launcher.setAttribute("aria-label", aria);
  s.launcherEls.launcherClose.setAttribute(
    "aria-label",
    getTranslation("common.close", "Close"),
  );
  s.launcherEls.peek.title = tip;
  s.launcherEls.peek.setAttribute("aria-label", aria);
}

function applyLauncherVisibility(s: ContentState) {
  s.launcherEls.launcher.setAttribute(
    "data-hidden",
    s.launcherDismissed ? "true" : "false",
  );
  s.launcherEls.peek.setAttribute(
    "data-visible",
    s.launcherDismissed ? "true" : "false",
  );
}

function dismissLauncher(s: ContentState) {
  s.launcherDismissed = true;
  writeLauncherDismissed(true);
  applyLauncherVisibility(s);
}

function restoreLauncher(s: ContentState) {
  s.launcherDismissed = false;
  writeLauncherDismissed(false);
  applyLauncherVisibility(s);
}

function openSidePanelFromLauncher() {
  // Fire-and-forget is intentional: Chrome only preserves the user-gesture
  // context for the SW when the message is sent synchronously inside the
  // click handler, with NO preceding await. Handing the message off through
  // a Promise chain (`.catch`) keeps the handler synchronous.
  try {
    chrome.runtime
      .sendMessage({ type: "OPEN_SIDE_PANEL" })
      .catch(() => undefined);
  } catch {
    // Service worker may be inactive; the toolbar icon is still a fallback.
  }
}

function refreshPanelI18n(s: ContentState) {
  const p = s.panelEls;
  const title = p.panel.querySelector<HTMLSpanElement>(".promptup-panel-title-text");
  const loadingText = p.loading.querySelector<HTMLSpanElement>(".promptup-panel-loading-text");
  const originalLabel = p.panel.querySelector<HTMLDivElement>(".promptup-panel-label-original");

  if (title) title.textContent = getTranslation("review.title", "Enhance with PromptUP");
  if (originalLabel) originalLabel.textContent = getTranslation("review.original", "Original prompt");
  p.enhancedLabel.textContent = getTranslation("review.enhanced", "Enhanced prompt");
  p.enhancedHint.textContent = getTranslation("review.enhancedHint", "You can edit the text before applying.");
  if (loadingText)
    loadingText.textContent = getTranslation("review.loading", "Enhancing with AI…");
  p.cancelBtn.textContent = getTranslation("review.reject", "Cancel");
  p.regenBtn.textContent = getTranslation("review.regenerate", "Regenerate");
  p.acceptBtn.textContent = getTranslation("review.accept", "Apply");
  p.closeBtn.setAttribute(
    "aria-label",
    getTranslation("review.reject", "Cancel"),
  );
  p.panel.setAttribute(
    "aria-label",
    getTranslation("review.title", "Enhance with PromptUP"),
  );
}

function injectHost(): ContentState | null {
  const adapter = resolveAdapter();
  if (!adapter) return null;
  if (document.getElementById(HOST_ID)) return state;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.inset = "0";
  host.style.pointerEvents = "none";
  host.style.zIndex = "2147483646";

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = styleText as unknown as string;
  shadow.appendChild(style);

  const rootEl = document.createElement("div");
  rootEl.className = "promptup-root";
  shadow.appendChild(rootEl);

  const button = document.createElement("button");
  button.type = "button";
  button.id = BUTTON_ID;
  button.className = "promptup-btn";
  button.setAttribute("data-visible", "false");
  button.setAttribute("data-tone", adapter.tone);
  button.setAttribute("aria-label", "PromptUP");
  button.innerHTML = `
    <svg class="promptup-spark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4L12 3z" fill="currentColor"/>
      <path d="M19 14l.9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9L19 14z" fill="currentColor" opacity="0.75"/>
    </svg>
  `;
  rootEl.appendChild(button);

  const toast = document.createElement("div");
  toast.className = "promptup-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("data-visible", "false");
  rootEl.appendChild(toast);

  const panelEls = createPanel(shadow);
  const launcherEls = createLauncher(rootEl);

  document.documentElement.appendChild(host);

  const created: ContentState = {
    adapter,
    shadowRoot: shadow,
    button,
    toast,
    rootEl,
    panelEls,
    launcherEls,
    currentTarget: null,
    currentSendBtn: null,
    buttonLoading: false,
    reviewOpen: false,
    reviewLoading: false,
    reviewOriginal: "",
    reviewEnhanced: "",
    launcherDismissed: readLauncherDismissed(),
    shiftedNeighbor: null,
    shiftedAmountPx: 0,
  };

  button.addEventListener("click", () => openReviewPanel(created));
  launcherEls.launcher.addEventListener("click", (e) => {
    // Clicking the ✕ inside the pill should dismiss, not open the sidepanel.
    if (
      e.target instanceof HTMLElement &&
      e.target.closest(
        `#${LAUNCHER_PEEK_ID}, .promptup-launcher-close`,
      )
    ) {
      return;
    }
    // Must fire synchronously: any async work here would strip the user
    // gesture context required by chrome.sidePanel.open().
    openSidePanelFromLauncher();
  });
  launcherEls.launcherClose.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissLauncher(created);
  });
  launcherEls.peek.addEventListener("click", () => restoreLauncher(created));
  panelEls.closeBtn.addEventListener("click", () => closeReviewPanel(created));
  panelEls.cancelBtn.addEventListener("click", () => closeReviewPanel(created));
  panelEls.backdrop.addEventListener("click", () => closeReviewPanel(created));
  panelEls.acceptBtn.addEventListener("click", () => acceptReview(created));
  panelEls.regenBtn.addEventListener("click", () => regenerateReview(created));
  panelEls.enhancedArea.addEventListener("input", () => {
    created.reviewEnhanced = panelEls.enhancedArea.value;
    panelEls.acceptBtn.disabled =
      created.reviewLoading || !created.reviewEnhanced.trim();
  });

  // Close with Escape key (only when panel is open).
  document.addEventListener("keydown", (e) => {
    if (created.reviewOpen && e.key === "Escape") {
      e.preventDefault();
      closeReviewPanel(created);
    }
  });

  refreshPanelI18n(created);

  return created;
}

function refreshTooltip(s: ContentState) {
  const label = s.buttonLoading
    ? getTranslation("enhance.loading", "Enhancing…")
    : getTranslation("enhance.button", "Enhance with PromptUP");
  s.button.setAttribute("data-tooltip", label);
  s.button.setAttribute("aria-label", label);
  s.button.title = label;
}

/**
 * Find the nearest visible sibling (up the ancestor chain) that sits to the
 * LEFT of the send button. On Claude/Gemini this is typically the model
 * picker or the mic button. We use this so we can shift it left and slot the
 * PromptUP button between it and the send button.
 */
function findSiblingLeftOfSend(sendBtn: HTMLElement): HTMLElement | null {
  let current: HTMLElement = sendBtn;
  for (let depth = 0; depth < 4; depth++) {
    let prev = current.previousElementSibling;
    while (prev) {
      if (prev instanceof HTMLElement && prev.offsetParent !== null) {
        const r = prev.getBoundingClientRect();
        if (r.width > 12 && r.height > 12) return prev;
      }
      prev = prev.previousElementSibling;
    }
    const parent = current.parentElement;
    if (!parent) break;
    current = parent;
  }
  return null;
}

function applyNeighborShift(
  s: ContentState,
  el: HTMLElement,
  amount: number,
) {
  if (s.shiftedNeighbor && s.shiftedNeighbor !== el) {
    s.shiftedNeighbor.style.marginRight = "";
  }
  if (s.shiftedNeighbor === el && s.shiftedAmountPx === amount) return;
  el.style.marginRight = `${amount}px`;
  s.shiftedNeighbor = el;
  s.shiftedAmountPx = amount;
}

function clearNeighborShift(s: ContentState) {
  if (s.shiftedNeighbor) {
    s.shiftedNeighbor.style.marginRight = "";
    s.shiftedNeighbor = null;
    s.shiftedAmountPx = 0;
  }
}

/**
 * Place the ✨ button immediately to the LEFT of the native send button.
 * If the space to the left is already occupied (e.g. Claude's model picker
 * or Gemini's mic/model selector), shift that neighbor left just enough to
 * slot our button in between it and the send button.
 *
 * Fallback order: left-of-send → above-send → top-right of textarea.
 */
function placeButton(
  s: ContentState,
  sendBtn: HTMLElement,
  target: HTMLElement,
) {
  const sendRect = sendBtn.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  if (sendRect.width < 20 || sendRect.height < 20) {
    clearNeighborShift(s);
    placeButtonFallback(s, target);
    return;
  }

  const size = Math.round(Math.min(Math.max(sendRect.width, 28), 36));
  s.button.style.width = `${size}px`;
  s.button.style.height = `${size}px`;

  const gap = s.adapter.gap;
  const neededGap = size + gap * 2;

  const neighbor = findSiblingLeftOfSend(sendBtn);
  if (neighbor) {
    const neighborRect = neighbor.getBoundingClientRect();
    const availableGap = sendRect.left - neighborRect.right;
    // If we're the ones who created part of the current gap, subtract that
    // out before deciding — otherwise the measurement oscillates every tick
    // and the site's model picker visibly jitters left and right.
    const currentShift =
      s.shiftedNeighbor === neighbor ? s.shiftedAmountPx : 0;
    const naturalGap = availableGap - currentShift;
    const desiredShift = Math.max(0, Math.round(neededGap - naturalGap));
    if (desiredShift > 0) {
      applyNeighborShift(s, neighbor, desiredShift);
    } else {
      clearNeighborShift(s);
    }
  } else {
    clearNeighborShift(s);
  }

  // Read a fresh rect in case the neighbor shift reflowed the composer.
  const freshRect = sendBtn.getBoundingClientRect();
  const verticalCenterTop = Math.round(
    freshRect.top + (freshRect.height - size) / 2,
  );
  const leftCandidate = Math.round(freshRect.left - gap - size);

  if (leftCandidate >= 4) {
    s.button.style.left = `${leftCandidate}px`;
    s.button.style.top = `${verticalCenterTop}px`;
    s.button.setAttribute("data-visible", "true");
    return;
  }

  // Not enough room on the left → float above the send button.
  const aboveTop = Math.round(freshRect.top - size - gap);
  const aboveLeft = Math.round(freshRect.left + (freshRect.width - size) / 2);
  if (aboveTop >= targetRect.top + 4) {
    s.button.style.left = `${aboveLeft}px`;
    s.button.style.top = `${aboveTop}px`;
    s.button.setAttribute("data-visible", "true");
    return;
  }

  clearNeighborShift(s);
  placeButtonFallback(s, target);
}

function placeButtonFallback(s: ContentState, target: HTMLElement) {
  const rect = target.getBoundingClientRect();
  if (rect.width < 32 || rect.height < 20) {
    s.button.setAttribute("data-visible", "false");
    return;
  }
  const size = 30;
  s.button.style.width = `${size}px`;
  s.button.style.height = `${size}px`;
  const left = Math.round(rect.right - size - 10);
  const top = Math.round(rect.top + 8);
  s.button.style.left = `${Math.max(left, rect.left + 8)}px`;
  s.button.style.top = `${top}px`;
  s.button.setAttribute("data-visible", "true");
}

function hideButton(s: ContentState) {
  s.button.setAttribute("data-visible", "false");
  clearNeighborShift(s);
}

function showToast(
  s: ContentState,
  message: string,
  tone: "info" | "success" | "error" = "info",
  durationMs = 3600,
) {
  s.toast.textContent = message;
  s.toast.setAttribute("data-tone", tone);
  s.toast.setAttribute("data-visible", "true");
  if (s.hideToastTimer) window.clearTimeout(s.hideToastTimer);
  s.hideToastTimer = window.setTimeout(() => {
    s.toast.setAttribute("data-visible", "false");
  }, durationMs);
}

function setPanelLoading(s: ContentState, loading: boolean) {
  s.reviewLoading = loading;
  s.panelEls.loading.hidden = !loading;
  s.panelEls.enhancedArea.hidden = loading;
  s.panelEls.enhancedHint.hidden = loading;
  s.panelEls.acceptBtn.disabled = loading || !s.reviewEnhanced.trim();
  s.panelEls.regenBtn.disabled = loading;
}

function setPanelError(s: ContentState, message: string | null) {
  if (!message) {
    s.panelEls.error.hidden = true;
    s.panelEls.error.textContent = "";
  } else {
    s.panelEls.error.hidden = false;
    s.panelEls.error.textContent = message;
  }
}

async function openReviewPanel(s: ContentState) {
  if (s.buttonLoading) return;
  const target = s.currentTarget ?? findTarget(s.adapter);
  s.currentTarget = target;
  if (!target) return;

  const input = s.adapter.getValue(target).trim();
  if (!input) {
    showToast(
      s,
      getTranslation("enhance.errors.EMPTY_INPUT", "Type a prompt first."),
      "error",
    );
    return;
  }

  s.reviewOriginal = input;
  s.reviewEnhanced = "";
  s.reviewOpen = true;
  refreshPanelI18n(s);
  s.panelEls.originalBody.textContent = input;
  s.panelEls.enhancedArea.value = "";
  setPanelError(s, null);
  setPanelLoading(s, true);
  s.panelEls.panel.setAttribute("data-visible", "true");
  s.panelEls.backdrop.setAttribute("data-visible", "true");

  await runEnhance(s);
}

function closeReviewPanel(s: ContentState) {
  s.reviewOpen = false;
  s.panelEls.panel.setAttribute("data-visible", "false");
  s.panelEls.backdrop.setAttribute("data-visible", "false");
}

async function runEnhance(s: ContentState) {
  setPanelError(s, null);
  setPanelLoading(s, true);
  try {
    const response = await sendEnhanceRequest(s.reviewOriginal);
    if (response.ok) {
      s.reviewEnhanced = response.text;
      s.panelEls.enhancedArea.value = response.text;
    } else {
      const key = `enhance.errors.${response.error}`;
      const fallback = response.message ?? "Something went wrong.";
      setPanelError(s, getTranslation(key, fallback));
      s.reviewEnhanced = "";
      s.panelEls.enhancedArea.value = "";
    }
  } catch (error) {
    setPanelError(
      s,
      (error as Error)?.message ??
        getTranslation("enhance.errors.UNKNOWN", "Something went wrong."),
    );
  } finally {
    setPanelLoading(s, false);
    if (s.reviewEnhanced.trim()) {
      window.requestAnimationFrame(() => {
        s.panelEls.enhancedArea.focus();
        s.panelEls.enhancedArea.setSelectionRange(
          s.reviewEnhanced.length,
          s.reviewEnhanced.length,
        );
      });
    }
  }
}

function regenerateReview(s: ContentState) {
  if (s.reviewLoading) return;
  void runEnhance(s);
}

function acceptReview(s: ContentState) {
  const text = s.panelEls.enhancedArea.value.trim();
  if (!text) return;
  const target = s.currentTarget ?? findTarget(s.adapter);
  if (!target) {
    showToast(s, getTranslation("enhance.errors.UNKNOWN", "No target"), "error");
    return;
  }
  try {
    s.adapter.setValue(target, text);
    closeReviewPanel(s);
    showToast(
      s,
      getTranslation("enhance.success", "Prompt enhanced"),
      "success",
    );
  } catch (error) {
    setPanelError(
      s,
      (error as Error)?.message ??
        getTranslation("enhance.errors.UNKNOWN", "Something went wrong."),
    );
  }
}

function observe() {
  const s = state;
  if (!s) return;

  const update = () => {
    const target = findTarget(s.adapter);
    s.currentTarget = target;
    if (!target) {
      s.currentSendBtn = null;
      hideButton(s);
      return;
    }
    // Only show the button when the user has actually typed something.
    // Otherwise the composer lacks a send button (Claude/Gemini hide it
    // until there's content), which causes the floating button to appear
    // in awkward positions.
    const value = s.adapter.getValue(target).trim();
    if (!value) {
      s.currentSendBtn = null;
      hideButton(s);
      return;
    }
    const sendBtn = findSendButton(s.adapter, target);
    s.currentSendBtn = sendBtn;
    if (sendBtn) {
      placeButton(s, sendBtn, target);
    } else {
      placeButtonFallback(s, target);
    }
  };

  const observer = new MutationObserver(update);
  observer.observe(document.body, { childList: true, subtree: true });

  const scheduled = () => window.requestAnimationFrame(update);
  window.addEventListener("scroll", scheduled, true);
  window.addEventListener("resize", scheduled);
  window.addEventListener("focusin", scheduled, true);
  window.addEventListener("focusout", scheduled, true);
  // React to text being typed/pasted/cleared so the button appears and
  // disappears in sync with composer content.
  document.addEventListener("input", scheduled, true);
  document.addEventListener("keyup", scheduled, true);

  update();
  const interval = window.setInterval(update, 1200);
  window.addEventListener("beforeunload", () => {
    observer.disconnect();
    window.clearInterval(interval);
    clearNeighborShift(s);
  });
}

async function boot() {
  if (!resolveAdapter()) return;
  try {
    const settings = await loadSettings();
    await initI18n(settings.language);
    await applyLanguagePref(settings.language);
  } catch {
    await initI18n("auto");
  }

  state = injectHost();
  if (!state) return;
  refreshTooltip(state);
  refreshPanelI18n(state);
  refreshLauncherI18n(state);
  applyLauncherVisibility(state);
  observe();
  registerMessageListener();
}

function registerMessageListener() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || typeof message !== "object") return false;
    if (message.type === "INSERT_PROMPT" && typeof message.text === "string") {
      const s = state;
      if (!s) {
        sendResponse({ ok: false });
        return false;
      }
      const target = findTarget(s.adapter) ?? s.currentTarget;
      if (!target) {
        sendResponse({ ok: false });
        return false;
      }
      try {
        const mode = message.mode === "append" ? "append" : "replace";
        let finalText = message.text;
        if (mode === "append") {
          const existing = s.adapter.getValue(target);
          if (existing && existing.length > 0) {
            const needsNewline = !/\n\s*$/.test(existing);
            finalText = existing + (needsNewline ? "\n\n" : "") + message.text;
          }
        }
        s.adapter.setValue(target, finalText);
        showToast(s, getTranslation("toast.inserted", "Inserted"), "success");
        sendResponse({ ok: true });
      } catch (error) {
        sendResponse({ ok: false, error: (error as Error)?.message });
      }
      return false;
    }
    return false;
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => void boot());
} else {
  void boot();
}
