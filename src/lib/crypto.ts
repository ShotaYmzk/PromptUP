/**
 * Lightweight XOR-based obfuscation for API keys stored in chrome.storage.local.
 *
 * Important: Manifest V3 extensions cannot provide true encryption at rest
 * because the key would have to live inside the bundled code. Treat this as
 * defense-in-depth that prevents casual reading in the DevTools storage tab,
 * not as a cryptographic guarantee.
 */

const OBFUSCATION_SEED = "PromptUP/v1/obf";
const PREFIX = "pup1:";

function xorBytes(input: Uint8Array, key: string): Uint8Array {
  const out = new Uint8Array(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = input[i] ^ key.charCodeAt(i % key.length);
  }
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function obfuscate(plain: string): string {
  if (!plain) return "";
  const bytes = new TextEncoder().encode(plain);
  const xored = xorBytes(bytes, OBFUSCATION_SEED);
  return PREFIX + toBase64(xored);
}

export function deobfuscate(stored: string): string {
  if (!stored) return "";
  if (!stored.startsWith(PREFIX)) {
    return stored;
  }
  try {
    const body = stored.slice(PREFIX.length);
    const bytes = fromBase64(body);
    const xored = xorBytes(bytes, OBFUSCATION_SEED);
    return new TextDecoder().decode(xored);
  } catch {
    return "";
  }
}

export function maskKey(key: string): string {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return `${key.slice(0, 4)}${"•".repeat(Math.max(key.length - 8, 4))}${key.slice(-4)}`;
}
