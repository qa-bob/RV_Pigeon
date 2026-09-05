const PLACEHOLDER_PATTERN = /\{\{([A-Z0-9_]+)\}\}/g;

/**
 * Replaces {{TOKEN}} placeholders in a template body with values from
 * `variables`. Per spec FR-016, any token with no value (missing, null, or
 * undefined) renders as blank rather than leaving the raw placeholder text.
 */
export function renderTemplate(
  body: string,
  variables: Record<string, string | null | undefined>,
): string {
  return body.replace(PLACEHOLDER_PATTERN, (_match, token: string) => variables[token] ?? "");
}
