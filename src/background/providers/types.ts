import type { EnhanceErrorCode } from "@/lib/types";

export interface EnhanceArgs {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  signal: AbortSignal;
  /** Sampling temperature (0.0–2.0). Providers pick a sensible default when unset. */
  temperature?: number;
}

export const DEFAULT_ENHANCE_TEMPERATURE = 0.5;

/** Clamp temperature into a safe range before sending to providers. */
export function normalizeTemperature(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_ENHANCE_TEMPERATURE;
  }
  return Math.min(Math.max(value, 0), 2);
}

export class ProviderError extends Error {
  code: EnhanceErrorCode;
  constructor(code: EnhanceErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
  }
}

export function classifyHttp(status: number): EnhanceErrorCode {
  if (status === 401 || status === 403) return "AUTH";
  if (status === 429) return "RATE_LIMIT";
  return "PROVIDER_ERROR";
}
