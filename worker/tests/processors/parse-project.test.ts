import { describe, it, expect, vi } from "vitest";
import { parseProject } from "../../src/processors/parse-project.js";
import type { LLMAdapter } from "../../src/llm/adapter.js";

function mockLLM(responseText: string): LLMAdapter {
  return {
    complete: vi.fn().mockResolvedValue({
      text: responseText,
      usage: { inputTokens: 100, outputTokens: 50 },
    }),
  };
}

describe("parseProject", () => {
  it("parses raw input into structured project data", async () => {
    const llm = mockLLM(
      JSON.stringify({
        name: "SocialPost Manager",
        description: "A tool for indie devs to schedule social media posts",
        target_users: "Solo developers without marketing teams",
        competitors: "Buffer, Hootsuite",
        goals: "1000 users in 3 months",
        success_metrics: "Monthly active users, retention rate",
      })
    );

    const result = await parseProject(llm, "I made a tool to help indie devs manage social media", undefined);
    expect(result.name).toBe("SocialPost Manager");
    expect(result.target_users).toContain("Solo");
    expect(llm.complete).toHaveBeenCalledOnce();
  });

  it("includes URL in prompt when provided", async () => {
    const llm = mockLLM(JSON.stringify({
      name: "Test", description: "Test", target_users: "Test",
      competitors: "Test", goals: "Test", success_metrics: "Test",
    }));

    await parseProject(llm, "Check my app", "https://myapp.com");
    const call = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain("https://myapp.com");
  });
});
