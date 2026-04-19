import {
  classifyHttp,
  EnhanceArgs,
  ProviderError,
  normalizeTemperature,
} from "./types";

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  error?: { message?: string };
}

export async function enhanceWithGemini(args: EnhanceArgs): Promise<string> {
  const { apiKey, model, systemPrompt, userPrompt, signal, temperature } = args;
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { role: "system", parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: { temperature: normalizeTemperature(temperature) },
    }),
  });

  if (!response.ok) {
    const raw = await safeJson<GeminiResponse>(response);
    throw new ProviderError(
      classifyHttp(response.status),
      raw?.error?.message ?? `Gemini error ${response.status}`,
    );
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p?.text ?? "")
    .join("")
    .trim();
  if (!text) throw new ProviderError("PROVIDER_ERROR", "Empty response from Gemini");
  return text;
}

async function safeJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
