const VAR_REGEX = /\{\{([a-zA-Z0-9_]+)\}\}/g;

export function extractVariables(body: string): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  for (const match of body.matchAll(VAR_REGEX)) {
    const name = match[1];
    if (!seen.has(name)) seen.add(name);
  }
  return Array.from(seen);
}

export function fillVariables(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(VAR_REGEX, (_, name: string) => {
    const v = values[name];
    return v === undefined ? `{{${name}}}` : v;
  });
}

export function hasVariables(body: string): boolean {
  return VAR_REGEX.test(body);
}
