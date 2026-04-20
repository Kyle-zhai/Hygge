export interface MediaItem {
  type: "image" | "video";
  url: string;
}

export interface LLMRequest {
  system: string;
  prompt: string;
  media?: MediaItem[];
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface LLMResponse {
  text: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMAdapter {
  complete(request: LLMRequest): Promise<LLMResponse>;
}

// Thrown when a provider stops generating because it hit the max-tokens cap.
// Callers (e.g. persona-review) catch this and retry with a higher budget or
// a tighter prompt instead of trying to parse a half-cut response.
export class LLMTruncatedError extends Error {
  readonly provider: string;
  readonly model: string;
  readonly outputTokens: number;
  readonly partialText: string;

  constructor(
    provider: string,
    model: string,
    outputTokens: number,
    partialText: string,
  ) {
    super(`LLM output truncated by max_tokens (provider=${provider} model=${model} outputTokens=${outputTokens})`);
    this.name = "LLMTruncatedError";
    this.provider = provider;
    this.model = model;
    this.outputTokens = outputTokens;
    this.partialText = partialText;
  }
}
