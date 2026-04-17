// Structured JSON logger — each line is a self-describing event.
// Railway, Loki, Datadog, and Betterstack can all ingest this without extra parsing.
// Keep the dependency surface at zero so it's safe to import anywhere.

type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

function sink(level: LogLevel): (line: string) => void {
  if (level === "error") return console.error.bind(console);
  if (level === "warn") return console.warn.bind(console);
  return console.log.bind(console);
}

function emit(level: LogLevel, event: string, ctx: LogContext = {}): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...ctx,
  };
  try {
    sink(level)(JSON.stringify(payload));
  } catch {
    // Circular refs or similar — fall back to a best-effort message.
    sink(level)(`{"ts":"${payload.ts}","level":"${level}","event":"${event}","logError":"serialization_failed"}`);
  }
}

export const log = {
  info: (event: string, ctx?: LogContext) => emit("info", event, ctx),
  warn: (event: string, ctx?: LogContext) => emit("warn", event, ctx),
  error: (event: string, ctx?: LogContext) => emit("error", event, ctx),
};

// Wrap an async operation and emit start/success/failure events with duration.
// Returns the wrapped function's result; re-throws on failure after logging.
export async function withTiming<T>(
  event: string,
  ctx: LogContext,
  op: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  try {
    const result = await op();
    log.info(event, { ...ctx, durationMs: Date.now() - started });
    return result;
  } catch (err) {
    log.error(`${event}.failed`, {
      ...ctx,
      durationMs: Date.now() - started,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
