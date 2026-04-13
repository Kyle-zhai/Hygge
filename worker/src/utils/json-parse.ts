export function robustJsonParse<T = unknown>(text: string): T {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(text.slice(start, end + 1));
    }
    throw new Error(`No valid JSON found in response: ${text.slice(0, 200)}`);
  }
}
