import {
  classifyHttp,
  EnhanceArgs,
  ProviderError,
  normalizeTemperature,
} from "./types";

interface OpenAIChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
}

export async function enhanceWithOpenAI(args: EnhanceArgs): Promise<string> {
  const { apiKey, model, systemPrompt, userPrompt, signal, temperature } = args;
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: normalizeTemperature(temperature),
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const raw = await safeJson<OpenAIChatResponse>(response);
    throw new ProviderError(
      classifyHttp(response.status),
      raw?.error?.message ?? `OpenAI error ${response.status}`,
    );
  }

  const data = (await response.json()) as OpenAIChatResponse;
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new ProviderError("PROVIDER_ERROR", "Empty response from OpenAI");
  return text;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
