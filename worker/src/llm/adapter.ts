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
