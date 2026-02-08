/**
 * Resolves variables by merging YAML-defined variables with CLI overrides,
 * and expanding {{env:VAR_NAME}} references from process.env.
 */
export function resolveVariables(
  yamlVars?: Record<string, string>,
  cliVars?: Record<string, string>
): Record<string, string> {
  const merged: Record<string, string> = { ...yamlVars, ...cliVars };

  for (const [key, value] of Object.entries(merged)) {
    const envMatch = value.match(/^\{\{env:(\w+)\}\}$/);
    if (envMatch) {
      const envName = envMatch[1];
      const envValue = process.env[envName];
      if (envValue === undefined) {
        throw new Error(`Environment variable "${envName}" is not set (referenced by variable "${key}")`);
      }
      merged[key] = envValue;
    }
  }

  return merged;
}

/**
 * Replaces {{varName}} placeholders in text with resolved variable values.
 * Throws if a placeholder references an undefined variable.
 */
export function substituteVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
    if (!(varName in variables)) {
      throw new Error(`Undefined variable "{{${varName}}}" in text: ${text}`);
    }
    return variables[varName];
  });
}
