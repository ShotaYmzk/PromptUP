import {
  classifyHttp,
  EnhanceArgs,
  ProviderError,
  normalizeTemperature,
} from "./types";

interface AnthropicMessagesResponse {
  content?: Array<{ type?: string; text?: string }>;
  error?: { message?: string; type?: string };
}

export async function enhanceWithAnthropic(args: EnhanceArgs): Promise<string> {
  const { apiKey, model, systemPrompt, userPrompt, signal, temperature } = args;
  // Anthropic accepts [0, 1]; clamp down any wider range from the caller.
  const clampedTemperature = Math.min(normalizeTemperature(temperature), 1);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      temperature: clampedTemperature,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const raw = await safeJson<AnthropicMessagesResponse>(response);
    throw new ProviderError(
      classifyHttp(response.status),
      raw?.error?.message ?? `Anthropic error ${response.status}`,
    );
  }

  const data = (await response.json()) as AnthropicMessagesResponse;
  const text = data.content
    ?.filter((c) => c?.type === "text" && c.text)
    .map((c) => c.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new ProviderError("PROVIDER_ERROR", "Empty response from Anthropic");
  }
  return text;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
