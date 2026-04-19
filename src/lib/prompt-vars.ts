const VAR_REGEX_SOURCE = /\{\{([a-zA-Z0-9_]+)\}\}/;

function variableRegexGlobal(): RegExp {
  return new RegExp(VAR_REGEX_SOURCE.source, "g");
}

export function extractVariables(body: string): string[] {
  if (!body) return [];
  const seen = new Set<string>();
  for (const match of body.matchAll(variableRegexGlobal())) {
    const name = match[1];
    if (!seen.has(name)) seen.add(name);
  }
  return Array.from(seen);
}

export function fillVariables(
  body: string,
  values: Record<string, string>,
): string {
  return body.replace(variableRegexGlobal(), (_, name: string) => {
    const v = values[name];
    return v === undefined ? `{{${name}}}` : v;
  });
}

export function hasVariables(body: string): boolean {
  return VAR_REGEX_SOURCE.test(body);
}
