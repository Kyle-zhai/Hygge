export interface MediaItem {
  type: "image" | "video";
  url: string;
}

export interface LLMRequest {
  system: string;
  prompt: string;
  media?: MediaItem[];
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface LLMAdapter {
  complete(request: LLMRequest): Promise<LLMResponse>;
}
