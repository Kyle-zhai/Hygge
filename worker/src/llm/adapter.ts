export interface LLMRequest {
  system: string;
  prompt: string;
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
