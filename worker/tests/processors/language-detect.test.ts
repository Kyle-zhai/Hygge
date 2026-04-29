import { describe, expect, it } from "vitest";
import {
  detectReplyLanguage,
  detectReplyLanguageWeighted,
  replyLanguageDirective,
} from "../../src/processors/language-detect.js";

describe("detectReplyLanguage", () => {
  it("returns 'en' for empty / null / whitespace", () => {
    expect(detectReplyLanguage("")).toBe("en");
    expect(detectReplyLanguage(null)).toBe("en");
    expect(detectReplyLanguage(undefined)).toBe("en");
    expect(detectReplyLanguage("    \n\t")).toBe("en");
  });

  it("returns 'en' for digits / punctuation only", () => {
    expect(detectReplyLanguage("12345 !@#$%")).toBe("en");
  });

  it("classifies pure English as 'en'", () => {
    expect(detectReplyLanguage("This is a debate about whether to ship now.")).toBe("en");
  });

  it("classifies pure Chinese as 'zh'", () => {
    expect(detectReplyLanguage("我们应该现在发布吗？这是一个值得讨论的话题。")).toBe("zh");
  });

  it("classifies mixed text dominated by Chinese as 'zh'", () => {
    // 5 CJK / 5 Latin = 50% — above 30% threshold
    expect(detectReplyLanguage("Hello 你好世界吗")).toBe("zh");
  });

  it("classifies mixed text dominated by English as 'en'", () => {
    // 1 CJK / 30 Latin ~ 3% — below threshold
    expect(detectReplyLanguage("This is a long English sentence with one 字 only")).toBe("en");
  });

  it("treats Chinese sentence with English brand names as 'zh'", () => {
    // ~12 CJK / 5 Latin (Apple) = 70% CJK
    expect(detectReplyLanguage("我觉得 Apple 的新产品定价太高了，不值得购买")).toBe("zh");
  });

  it("ignores whitespace and digits when computing the ratio", () => {
    // 4 CJK / 4 Latin = 50% — should be 'zh'; digits and spaces shouldn't dilute
    expect(detectReplyLanguage("price 1999 元 太 贵 了")).toBe("zh");
  });
});

describe("detectReplyLanguageWeighted", () => {
  it("returns 'en' when all snippets empty", () => {
    expect(detectReplyLanguageWeighted([])).toBe("en");
    expect(detectReplyLanguageWeighted([{ text: "" }, { text: null }])).toBe("en");
  });

  it("weights later snippets more when given higher weight", () => {
    // Project description in English, latest user turn in Chinese with weight 3
    const snippets = [
      { text: "An English-only project description, fairly long", weight: 1 },
      { text: "我现在改用中文继续讨论", weight: 3 },
    ];
    expect(detectReplyLanguageWeighted(snippets)).toBe("zh");
  });

  it("falls back to 'en' when weighted snippet is empty", () => {
    const snippets = [
      { text: "An English description", weight: 1 },
      { text: undefined, weight: 5 },
    ];
    expect(detectReplyLanguageWeighted(snippets)).toBe("en");
  });

  it("matches single-snippet result when weight=1", () => {
    const text = "我们应该现在发布 Apple 新产品吗";
    expect(detectReplyLanguageWeighted([{ text }])).toBe(detectReplyLanguage(text));
  });
});

describe("replyLanguageDirective", () => {
  it("returns a Chinese directive for 'zh'", () => {
    const out = replyLanguageDirective("zh");
    expect(out).toContain("REPLY LANGUAGE");
    expect(out).toContain("Chinese");
    expect(out).toContain("Simplified");
    expect(out).toContain("proper nouns");
  });

  it("returns an English directive for 'en'", () => {
    const out = replyLanguageDirective("en");
    expect(out).toContain("REPLY LANGUAGE");
    expect(out).toContain("English");
    expect(out).toContain("proper nouns");
  });
});
