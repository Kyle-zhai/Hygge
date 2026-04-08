# Plan 2: Persona & Evaluation Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the AI Worker that processes evaluation jobs — parsing project input, generating persona reviews, producing summary reports, and running scenario simulations.

**Architecture:** Standalone Node.js worker using BullMQ + Redis for job queuing. LLM calls go through an abstract adapter layer (Claude Sonnet 4.6 as default). Worker writes results to Supabase DB and uses Supabase Realtime for progress notifications. Next.js API routes create jobs and query results.

**Tech Stack:** Node.js, TypeScript, BullMQ, Redis (ioredis), @anthropic-ai/sdk, Supabase JS, Vitest (testing)

---

## File Structure

```
worker/
├── package.json
├── tsconfig.json
├── .env
├── src/
│   ├── index.ts                    # Worker entry point — starts BullMQ worker
│   ├── config.ts                   # Environment config
│   ├── queue.ts                    # Queue + connection setup
│   ├── supabase.ts                 # Supabase admin client (service role)
│   ├── llm/
│   │   ├── adapter.ts              # Abstract LLM interface
│   │   └── claude.ts               # Claude Sonnet 4.6 implementation
│   ├── processors/
│   │   ├── parse-project.ts        # Parse raw input → structured project data
│   │   ├── recommend-personas.ts   # Recommend personas based on project
│   │   ├── persona-review.ts       # Generate single persona review
│   │   ├── summary-report.ts       # Generate comprehensive summary report
│   │   ├── scenario-simulation.ts  # Max plan: social influence simulation
│   │   └── orchestrator.ts         # Main job processor — coordinates full pipeline
│   └── prompts/
│       ├── parse-project.ts        # System prompt for project parsing
│       ├── persona-review.ts       # System prompt template for persona review
│       ├── summary-report.ts       # System prompt for summary generation
│       └── scenario-simulation.ts  # System prompt for scenario simulation
├── data/
│   └── personas.json               # 12 pre-built persona definitions
└── tests/
    ├── llm/
    │   └── adapter.test.ts
    ├── processors/
    │   ├── parse-project.test.ts
    │   └── persona-review.test.ts
    └── setup.ts                    # Test helpers + mocks

src/app/api/                        # Next.js API routes (in main project)
├── evaluations/
│   ├── route.ts                    # POST: create evaluation, GET: list
│   └── [id]/
│       └── route.ts                # GET: evaluation details + results
└── personas/
    ├── route.ts                    # GET: list all personas
    └── recommend/
        └── route.ts                # POST: recommend personas for a project
```

---

### Task 1: Worker Project Setup

**Files:**
- Create: `worker/package.json`, `worker/tsconfig.json`, `worker/.env`, `worker/src/config.ts`, `worker/src/queue.ts`, `worker/src/supabase.ts`

- [ ] **Step 1: Create worker package.json**

Create `worker/package.json`:
```json
{
  "name": "persona-worker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@supabase/supabase-js": "^2.102.0",
    "bullmq": "^5.34.0",
    "ioredis": "^5.4.0",
    "zod": "^3.24.0"
  },
  "devDependencies": {
    "@types/node": "^20.19.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.1.0"
  }
}
```

- [ ] **Step 2: Create worker tsconfig.json**

Create `worker/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "paths": {
      "@shared/*": ["../shared/*"]
    },
    "baseUrl": "."
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 3: Create worker .env**

Create `worker/.env`:
```env
REDIS_URL=redis://localhost:6379
ANTHROPIC_API_KEY=your_anthropic_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

- [ ] **Step 4: Create config.ts**

Create `worker/src/config.ts`:
```typescript
import "dotenv/config";

export const config = {
  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || "",
    model: "claude-sonnet-4-6",
  },
  supabase: {
    url: process.env.SUPABASE_URL || "",
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  },
} as const;
```

- [ ] **Step 5: Create queue.ts**

Create `worker/src/queue.ts`:
```typescript
import { Queue, Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

const connection: ConnectionOptions = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
});

export const evaluationQueue = new Queue("evaluations", { connection });

export function createWorker(
  processor: Parameters<typeof Worker>[1],
  concurrency = 1
) {
  return new Worker("evaluations", processor, {
    connection,
    concurrency,
  });
}
```

- [ ] **Step 6: Create supabase.ts**

Create `worker/src/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey,
  {
    auth: { persistSession: false },
  }
);
```

- [ ] **Step 7: Install dependencies**

Run:
```bash
cd /Users/pinan/Desktop/persona/worker
npm install
```

- [ ] **Step 8: Add dotenv dependency**

Run:
```bash
cd /Users/pinan/Desktop/persona/worker
npm install dotenv
```

- [ ] **Step 9: Add worker/.env to root .gitignore**

Append to `/Users/pinan/Desktop/persona/.gitignore`:
```
worker/.env
```

- [ ] **Step 10: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/ .gitignore
git commit -m "feat: set up worker project with BullMQ, Redis, Supabase config"
```

---

### Task 2: LLM Adapter Layer

**Files:**
- Create: `worker/src/llm/adapter.ts`, `worker/src/llm/claude.ts`
- Test: `worker/tests/llm/adapter.test.ts`

- [ ] **Step 1: Write the test**

Create `worker/tests/llm/adapter.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { ClaudeLLM } from "../../src/llm/claude.js";

describe("LLM Adapter", () => {
  it("ClaudeLLM implements LLMAdapter interface", () => {
    const llm = new ClaudeLLM("fake-key", "claude-sonnet-4-6");
    expect(llm).toHaveProperty("complete");
    expect(typeof llm.complete).toBe("function");
  });

  it("ClaudeLLM.complete calls Anthropic API with correct params", async () => {
    const mockCreate = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: '{"result": "test"}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const llm = new ClaudeLLM("fake-key", "claude-sonnet-4-6");
    // Mock the internal client
    (llm as any).client = { messages: { create: mockCreate } };

    const result = await llm.complete({
      system: "You are a helpful assistant.",
      prompt: "Say hello",
      maxTokens: 1000,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      system: "You are a helpful assistant.",
      messages: [{ role: "user", content: "Say hello" }],
    });

    expect(result.text).toBe('{"result": "test"}');
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 50 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/pinan/Desktop/persona/worker && npx vitest run tests/llm/adapter.test.ts`
Expected: FAIL (modules not found)

- [ ] **Step 3: Create LLM adapter interface**

Create `worker/src/llm/adapter.ts`:
```typescript
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
```

- [ ] **Step 4: Create Claude implementation**

Create `worker/src/llm/claude.ts`:
```typescript
import Anthropic from "@anthropic-ai/sdk";
import type { LLMAdapter, LLMRequest, LLMResponse } from "./adapter.js";

export class ClaudeLLM implements LLMAdapter {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async complete(request: LLMRequest): Promise<LLMResponse> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: request.maxTokens ?? 4096,
      system: request.system,
      messages: [{ role: "user", content: request.prompt }],
    });

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    return {
      text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    };
  }
}
```

- [ ] **Step 5: Run tests**

Run: `cd /Users/pinan/Desktop/persona/worker && npx vitest run tests/llm/adapter.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/src/llm/ worker/tests/
git commit -m "feat: add LLM adapter layer with Claude implementation"
```

---

### Task 3: Persona Seed Data

**Files:**
- Create: `worker/data/personas.json`

- [ ] **Step 1: Create 12 pre-built personas**

Create `worker/data/personas.json` with 12 persona definitions. Each persona must follow the full 11-layer model from `shared/types/persona.ts`. Include these personas:

1. **Sarah Chen** — Independent full-stack developer (technical)
2. **Mike Zhang** — Senior product manager at tech company (product)
3. **Yuki Tanaka** — UI/UX designer, freelance (design)
4. **David Li** — Angel investor, ex-founder (business)
5. **Emma Wang** — Digital marketing specialist (business)
6. **Alex Liu** — College CS student (end_user)
7. **Jennifer Wu** — Office worker, non-technical (end_user)
8. **Tom Harris** — Startup CTO, 10+ years experience (technical)
9. **Lisa Park** — Freelance content creator (end_user)
10. **Ryan Zhao** — Serial entrepreneur, 3 startups (product)
11. **Sophie Martin** — UX researcher (design)
12. **James Chen** — Growth hacker, data-driven (business)

Each persona JSON object must have all 11 layers populated with realistic, detailed data. The `system_prompt` field should be a comprehensive natural language character description (200-400 words) that the LLM uses to role-play the evaluation.

For each persona, make sure:
- `identity.locale_variants` has both `zh` and `en` variants
- `psychology.persuadability` is a float 0-1
- `psychology.risk_tolerance` and `patience_level` are floats 0-1
- `evaluation_lens.scoring_weights` values sum to 1.0
- `internal_conflicts` has 2-3 entries
- `contextual_behaviors` covers all 6 situations
- `system_prompt` integrates ALL 11 layers into natural language

This is a large file. Focus on making each persona feel distinct and realistic. Each should evaluate products differently based on their unique combination of traits.

- [ ] **Step 2: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/data/
git commit -m "feat: add 12 pre-built persona definitions with full 11-layer model"
```

---

### Task 4: Prompt Templates

**Files:**
- Create: `worker/src/prompts/parse-project.ts`, `worker/src/prompts/persona-review.ts`, `worker/src/prompts/summary-report.ts`, `worker/src/prompts/scenario-simulation.ts`

- [ ] **Step 1: Create project parsing prompt**

Create `worker/src/prompts/parse-project.ts`:
```typescript
export const PARSE_PROJECT_SYSTEM = `You are a project analysis assistant. Your job is to extract structured information from a user's project description.

The user may provide:
- Plain text describing their project
- A URL to their product/website
- A mix of text and URLs

Extract the following fields. If a field cannot be determined from the input, use "Not specified" as the value.

Respond ONLY with valid JSON in this exact format:
{
  "name": "Project name",
  "description": "What the project does (2-3 sentences)",
  "target_users": "Who the target users are",
  "competitors": "Known competitors or alternatives",
  "goals": "What the user wants to achieve",
  "success_metrics": "How they measure success"
}`;

export function buildParseProjectPrompt(rawInput: string, url?: string): string {
  let prompt = `Here is the user's project submission:\n\n${rawInput}`;
  if (url) {
    prompt += `\n\nProject URL: ${url}`;
  }
  return prompt;
}
```

- [ ] **Step 2: Create persona review prompt**

Create `worker/src/prompts/persona-review.ts`:
```typescript
import type { Persona } from "../../shared/types/persona.js";
import type { ProjectParsedData } from "../../shared/types/evaluation.js";

export function buildPersonaReviewPrompt(
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string
): { system: string; prompt: string } {
  const system = `${persona.system_prompt}

You are evaluating a product/project. Stay completely in character. Your evaluation should reflect your unique perspective, biases, blind spots, and emotional reactions as defined in your character.

IMPORTANT EVALUATION RULES:
- Score each dimension from 1-10 (integers only)
- Your scoring should reflect your scoring_weights — dimensions you care about more should have more detailed analysis
- Be specific and concrete — reference actual features or aspects of the product
- Your strengths/weaknesses should reflect YOUR perspective, not a generic analysis
- If something triggers your known biases or blind spots, let that show naturally
- React to the product the way you would in real life based on your contextual_behaviors

Respond ONLY with valid JSON in this exact format:
{
  "scores": {
    "usability": <1-10>,
    "market_fit": <1-10>,
    "design": <1-10>,
    "tech_quality": <1-10>,
    "innovation": <1-10>,
    "pricing": <1-10>
  },
  "review_text": "<Your detailed review, 200-400 words, written in first person as your character>",
  "strengths": ["<specific strength 1>", "<specific strength 2>", ...],
  "weaknesses": ["<specific weakness 1>", "<specific weakness 2>", ...]
}`;

  const prompt = `Please evaluate this project:

**Project Name:** ${project.name}
**Description:** ${project.description}
**Target Users:** ${project.target_users}
**Competitors:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}

**Original user description:**
${rawInput}`;

  return { system, prompt };
}
```

- [ ] **Step 3: Create summary report prompt**

Create `worker/src/prompts/summary-report.ts`:
```typescript
import type { PersonaReview, ProjectParsedData } from "../../shared/types/evaluation.js";

export function buildSummaryReportPrompt(
  project: ProjectParsedData,
  reviews: (PersonaReview & { persona_name: string })[],
  rawInput: string
): { system: string; prompt: string } {
  const system = `You are a senior product consultant generating a comprehensive evaluation report. You are synthesizing evaluations from multiple AI personas into an actionable product diagnosis.

Your report must be EXTREMELY specific and actionable. Not vague platitudes — concrete, detailed analysis that a developer can immediately act on.

Respond ONLY with valid JSON matching this structure:
{
  "overall_score": <1-10, one decimal>,
  "persona_analysis": {
    "entries": [
      {
        "persona_id": "<id>",
        "persona_name": "<name>",
        "core_viewpoint": "<2-3 sentence summary of this persona's key takeaway>",
        "scoring_rationale": "<why they scored the way they did>"
      }
    ],
    "consensus": [
      { "point": "<what they agree on>", "supporting_personas": ["<name1>", "<name2>"] }
    ],
    "disagreements": [
      {
        "point": "<what they disagree on>",
        "sides": [
          { "persona_ids": ["<id>"], "position": "<their stance>" }
        ],
        "reason": "<why they disagree>"
      }
    ]
  },
  "multi_dimensional_analysis": [
    {
      "dimension": "<usability|market_fit|design|tech_quality|innovation|pricing>",
      "score": <averaged score>,
      "strengths": ["<specific strength>"],
      "weaknesses": ["<specific weakness>"],
      "analysis": "<100-200 word deep analysis for this dimension>"
    }
  ],
  "goal_assessment": [
    {
      "goal": "<user's stated goal>",
      "achievable": <true|false>,
      "current_status": "<where the product stands relative to this goal>",
      "gaps": ["<specific gap>"]
    }
  ],
  "if_not_feasible": {
    "modifications": ["<specific modification>"],
    "direction": "<recommended pivot direction>",
    "priorities": ["<priority 1>", "<priority 2>"],
    "reference_cases": ["<similar product that succeeded with this approach>"]
  },
  "if_feasible": {
    "next_steps": ["<specific next step>"],
    "optimizations": ["<specific optimization>"],
    "risks": ["<specific risk>"]
  },
  "action_items": [
    {
      "description": "<specific action>",
      "priority": "<critical|high|medium|low>",
      "expected_impact": "<what this will improve>",
      "difficulty": "<easy|medium|hard>"
    }
  ],
  "market_readiness": "<low|medium|high>"
}`;

  const reviewsSummary = reviews
    .map(
      (r) =>
        `### ${r.persona_name} (ID: ${r.persona_id})
Scores: usability=${r.scores.usability}, market_fit=${r.scores.market_fit}, design=${r.scores.design}, tech_quality=${r.scores.tech_quality}, innovation=${r.scores.innovation}, pricing=${r.scores.pricing}
Review: ${r.review_text}
Strengths: ${r.strengths.join(", ")}
Weaknesses: ${r.weaknesses.join(", ")}`
    )
    .join("\n\n");

  const prompt = `Generate a comprehensive evaluation report for this project.

## Project Information
**Name:** ${project.name}
**Description:** ${project.description}
**Target Users:** ${project.target_users}
**Competitors:** ${project.competitors}
**Goals:** ${project.goals}
**Success Metrics:** ${project.success_metrics}

**Original description:** ${rawInput}

## Individual Persona Reviews

${reviewsSummary}

Generate the comprehensive summary report. Be EXTREMELY specific and actionable. Reference specific aspects of the product. Every recommendation should be concrete enough that a developer could immediately start working on it.`;

  return { system, prompt };
}
```

- [ ] **Step 4: Create scenario simulation prompt**

Create `worker/src/prompts/scenario-simulation.ts`:
```typescript
import type { PersonaReview } from "../../shared/types/evaluation.js";
import type { Persona } from "../../shared/types/persona.js";

export function buildScenarioSimulationPrompt(
  personas: Persona[],
  reviews: (PersonaReview & { persona_name: string })[]
): { system: string; prompt: string } {
  const system = `You are a social dynamics simulator. You will simulate a real-world scenario where all the given personas are in the same physical space (e.g., a tech meetup, conference, or coworking space) and the product is being discussed.

Consider each persona's:
- Persuadability (how easily influenced they are)
- Social circle and trust sources (who they listen to)
- Cognitive biases
- Internal conflicts
- Community influence level (how much they influence others)
- Risk tolerance

Simulate the social dynamics:
1. Start with each persona's initial stance based on their review
2. Model influence events — who would talk to whom, who would be convinced by whom
3. Consider that enthusiastic users can create social proof
4. Consider that influential skeptics can dampen enthusiasm
5. End with final adoption stances

Respond ONLY with valid JSON:
{
  "initial_adoption": [
    { "persona_id": "<id>", "stance": "<positive|neutral|negative>" }
  ],
  "influence_events": [
    {
      "influencer_id": "<id>",
      "influenced_id": "<id>",
      "shift": "<description of what changed>",
      "reason": "<why this influence worked>"
    }
  ],
  "final_adoption": [
    { "persona_id": "<id>", "stance": "<positive|neutral|negative>" }
  ],
  "adoption_rate_shift": <percentage change, e.g. 15 means +15%>,
  "summary": "<200-300 word narrative of what happened in the simulation>"
}`;

  const personaProfiles = personas
    .map((p) => {
      const review = reviews.find((r) => r.persona_id === p.id);
      return `### ${p.identity.name} (ID: ${p.id})
Role: ${p.demographics.occupation}
Persuadability: ${p.psychology.decision_making.persuadability}
Community Influence: ${p.social_context.relationships_with_products.community_influence}
Risk Tolerance: ${p.psychology.risk_tolerance}
Trust Sources: ${p.social_context.social_circle.trust_sources.join(", ")}
Overall Score Given: ${review ? Object.values(review.scores).reduce((a, b) => a + b, 0) / 6 : "N/A"}
Stance: ${review ? (Object.values(review.scores).reduce((a, b) => a + b, 0) / 6 > 6 ? "Positive" : Object.values(review.scores).reduce((a, b) => a + b, 0) / 6 > 4 ? "Neutral" : "Negative") : "Unknown"}`;
    })
    .join("\n\n");

  const prompt = `Simulate the social dynamics for these personas discussing the product:

${personaProfiles}

Run the simulation considering real-world social dynamics, peer pressure, and influence patterns.`;

  return { system, prompt };
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/src/prompts/
git commit -m "feat: add LLM prompt templates for all evaluation stages"
```

---

### Task 5: Project Parser Processor

**Files:**
- Create: `worker/src/processors/parse-project.ts`
- Test: `worker/tests/processors/parse-project.test.ts`

- [ ] **Step 1: Write the test**

Create `worker/tests/processors/parse-project.test.ts`:
```typescript
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

    const result = await parseProject(
      llm,
      "I made a tool to help indie devs manage social media",
      undefined
    );

    expect(result.name).toBe("SocialPost Manager");
    expect(result.target_users).toContain("Solo");
    expect(llm.complete).toHaveBeenCalledOnce();
  });

  it("includes URL in prompt when provided", async () => {
    const llm = mockLLM(
      JSON.stringify({
        name: "Test",
        description: "Test",
        target_users: "Test",
        competitors: "Test",
        goals: "Test",
        success_metrics: "Test",
      })
    );

    await parseProject(llm, "Check my app", "https://myapp.com");

    const call = (llm.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.prompt).toContain("https://myapp.com");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/pinan/Desktop/persona/worker && npx vitest run tests/processors/parse-project.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement parse-project processor**

Create `worker/src/processors/parse-project.ts`:
```typescript
import type { LLMAdapter } from "../llm/adapter.js";
import type { ProjectParsedData } from "../../shared/types/evaluation.js";
import {
  PARSE_PROJECT_SYSTEM,
  buildParseProjectPrompt,
} from "../prompts/parse-project.js";

export async function parseProject(
  llm: LLMAdapter,
  rawInput: string,
  url?: string
): Promise<ProjectParsedData> {
  const response = await llm.complete({
    system: PARSE_PROJECT_SYSTEM,
    prompt: buildParseProjectPrompt(rawInput, url),
    maxTokens: 1024,
  });

  return JSON.parse(response.text) as ProjectParsedData;
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/pinan/Desktop/persona/worker && npx vitest run tests/processors/parse-project.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/src/processors/parse-project.ts worker/tests/processors/parse-project.test.ts
git commit -m "feat: add project parser processor with tests"
```

---

### Task 6: Persona Review Processor

**Files:**
- Create: `worker/src/processors/persona-review.ts`
- Test: `worker/tests/processors/persona-review.test.ts`

- [ ] **Step 1: Write the test**

Create `worker/tests/processors/persona-review.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { generatePersonaReview } from "../../src/processors/persona-review.js";
import type { LLMAdapter } from "../../src/llm/adapter.js";
import type { Persona } from "../../../shared/types/persona.js";
import type { ProjectParsedData } from "../../../shared/types/evaluation.js";

const mockPersona: Partial<Persona> = {
  id: "persona-1",
  identity: {
    name: "Sarah Chen",
    avatar: "",
    tagline: "Indie dev",
    locale_variants: {
      zh: { name: "陈莎拉", tagline: "独立开发者" },
      en: { name: "Sarah Chen", tagline: "Indie dev" },
    },
  },
  system_prompt: "You are Sarah Chen, an indie developer...",
};

const mockProject: ProjectParsedData = {
  name: "TestApp",
  description: "A test application",
  target_users: "Developers",
  competitors: "None",
  goals: "Get users",
  success_metrics: "DAU",
};

function mockLLM(responseText: string): LLMAdapter {
  return {
    complete: vi.fn().mockResolvedValue({
      text: responseText,
      usage: { inputTokens: 200, outputTokens: 300 },
    }),
  };
}

describe("generatePersonaReview", () => {
  it("generates a review with scores, text, strengths, and weaknesses", async () => {
    const llm = mockLLM(
      JSON.stringify({
        scores: {
          usability: 8,
          market_fit: 7,
          design: 6,
          tech_quality: 9,
          innovation: 7,
          pricing: 5,
        },
        review_text: "As an indie developer, I find this tool quite useful...",
        strengths: ["Good API design", "Fast performance"],
        weaknesses: ["Pricing is too high", "Limited integrations"],
      })
    );

    const result = await generatePersonaReview(
      llm,
      mockPersona as Persona,
      mockProject,
      "I made a dev tool"
    );

    expect(result.scores.usability).toBe(8);
    expect(result.scores.tech_quality).toBe(9);
    expect(result.review_text).toContain("indie developer");
    expect(result.strengths).toHaveLength(2);
    expect(result.weaknesses).toHaveLength(2);
    expect(result.llm_model).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/pinan/Desktop/persona/worker && npx vitest run tests/processors/persona-review.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement persona review processor**

Create `worker/src/processors/persona-review.ts`:
```typescript
import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../../shared/types/persona.js";
import type {
  EvaluationScores,
  ProjectParsedData,
} from "../../shared/types/evaluation.js";
import { buildPersonaReviewPrompt } from "../prompts/persona-review.js";
import { config } from "../config.js";

export interface PersonaReviewResult {
  scores: EvaluationScores;
  review_text: string;
  strengths: string[];
  weaknesses: string[];
  llm_model: string;
}

export async function generatePersonaReview(
  llm: LLMAdapter,
  persona: Persona,
  project: ProjectParsedData,
  rawInput: string
): Promise<PersonaReviewResult> {
  const { system, prompt } = buildPersonaReviewPrompt(persona, project, rawInput);

  const response = await llm.complete({
    system,
    prompt,
    maxTokens: 2048,
  });

  const parsed = JSON.parse(response.text);

  return {
    scores: parsed.scores,
    review_text: parsed.review_text,
    strengths: parsed.strengths,
    weaknesses: parsed.weaknesses,
    llm_model: config.anthropic.model,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `cd /Users/pinan/Desktop/persona/worker && npx vitest run tests/processors/persona-review.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/src/processors/persona-review.ts worker/tests/processors/persona-review.test.ts
git commit -m "feat: add persona review processor with tests"
```

---

### Task 7: Summary Report + Scenario Simulation Processors

**Files:**
- Create: `worker/src/processors/summary-report.ts`, `worker/src/processors/scenario-simulation.ts`, `worker/src/processors/recommend-personas.ts`

- [ ] **Step 1: Create summary report processor**

Create `worker/src/processors/summary-report.ts`:
```typescript
import type { LLMAdapter } from "../llm/adapter.js";
import type { PersonaReview, ProjectParsedData } from "../../shared/types/evaluation.js";
import type { SummaryReport } from "../../shared/types/report.js";
import { buildSummaryReportPrompt } from "../prompts/summary-report.js";

export async function generateSummaryReport(
  llm: LLMAdapter,
  project: ProjectParsedData,
  reviews: (PersonaReview & { persona_name: string })[],
  rawInput: string
): Promise<Omit<SummaryReport, "id" | "evaluation_id">> {
  const { system, prompt } = buildSummaryReportPrompt(project, reviews, rawInput);

  const response = await llm.complete({
    system,
    prompt,
    maxTokens: 8192,
  });

  const parsed = JSON.parse(response.text);

  return {
    overall_score: parsed.overall_score,
    persona_analysis: parsed.persona_analysis,
    multi_dimensional_analysis: parsed.multi_dimensional_analysis,
    goal_assessment: parsed.goal_assessment,
    if_not_feasible: parsed.if_not_feasible,
    if_feasible: parsed.if_feasible,
    action_items: parsed.action_items,
    market_readiness: parsed.market_readiness,
    scenario_simulation: null,
  };
}
```

- [ ] **Step 2: Create scenario simulation processor**

Create `worker/src/processors/scenario-simulation.ts`:
```typescript
import type { LLMAdapter } from "../llm/adapter.js";
import type { PersonaReview } from "../../shared/types/evaluation.js";
import type { Persona } from "../../shared/types/persona.js";
import type { ScenarioSimulationResult } from "../../shared/types/report.js";
import { buildScenarioSimulationPrompt } from "../prompts/scenario-simulation.js";

export async function runScenarioSimulation(
  llm: LLMAdapter,
  personas: Persona[],
  reviews: (PersonaReview & { persona_name: string })[]
): Promise<ScenarioSimulationResult> {
  const { system, prompt } = buildScenarioSimulationPrompt(personas, reviews);

  const response = await llm.complete({
    system,
    prompt,
    maxTokens: 4096,
  });

  return JSON.parse(response.text) as ScenarioSimulationResult;
}
```

- [ ] **Step 3: Create persona recommender processor**

Create `worker/src/processors/recommend-personas.ts`:
```typescript
import type { LLMAdapter } from "../llm/adapter.js";
import type { Persona } from "../../shared/types/persona.js";

const RECOMMEND_SYSTEM = `You are a focus group coordinator. Given a project description and a list of available personas, recommend the most relevant personas for evaluating this project.

Consider:
- The project's target users — include personas that match the target audience
- Diverse perspectives — include technical, business, design, and end-user viewpoints
- Relevant expertise — include personas whose expertise is relevant to the project domain

Respond ONLY with valid JSON:
{
  "recommended_ids": ["<persona_id_1>", "<persona_id_2>", ...],
  "reasoning": "<brief explanation of why these personas were chosen>"
}`;

export async function recommendPersonas(
  llm: LLMAdapter,
  projectDescription: string,
  availablePersonas: Persona[]
): Promise<{ recommended_ids: string[]; reasoning: string }> {
  const personaList = availablePersonas
    .map(
      (p) =>
        `- ID: ${p.id} | ${p.identity.name} | ${p.demographics.occupation} | Focus: ${p.evaluation_lens.primary_question}`
    )
    .join("\n");

  const response = await llm.complete({
    system: RECOMMEND_SYSTEM,
    prompt: `Project: ${projectDescription}\n\nAvailable personas:\n${personaList}`,
    maxTokens: 1024,
  });

  return JSON.parse(response.text);
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/src/processors/
git commit -m "feat: add summary report, scenario simulation, and persona recommendation processors"
```

---

### Task 8: Evaluation Orchestrator

**Files:**
- Create: `worker/src/processors/orchestrator.ts`, `worker/src/index.ts`

- [ ] **Step 1: Create orchestrator**

Create `worker/src/processors/orchestrator.ts`:
```typescript
import type { Job } from "bullmq";
import { supabase } from "../supabase.js";
import { ClaudeLLM } from "../llm/claude.js";
import { config } from "../config.js";
import { parseProject } from "./parse-project.js";
import { generatePersonaReview } from "./persona-review.js";
import { generateSummaryReport } from "./summary-report.js";
import { runScenarioSimulation } from "./scenario-simulation.js";
import type { Persona } from "../../shared/types/persona.js";

interface EvaluationJobData {
  evaluationId: string;
  projectId: string;
  rawInput: string;
  url?: string;
  selectedPersonaIds: string[];
  planTier: "free" | "pro" | "max";
}

export async function processEvaluation(job: Job<EvaluationJobData>) {
  const { evaluationId, projectId, rawInput, url, selectedPersonaIds, planTier } =
    job.data;

  const llm = new ClaudeLLM(config.anthropic.apiKey, config.anthropic.model);

  try {
    // 1. Update status to processing
    await supabase
      .from("evaluations")
      .update({ status: "processing" })
      .eq("id", evaluationId);

    // 2. Parse project input
    const parsedData = await parseProject(llm, rawInput, url);

    await supabase
      .from("projects")
      .update({ parsed_data: parsedData })
      .eq("id", projectId);

    // 3. Fetch selected personas
    const { data: personas } = await supabase
      .from("personas")
      .select("*")
      .in("id", selectedPersonaIds);

    if (!personas || personas.length === 0) {
      throw new Error("No personas found for selected IDs");
    }

    // 4. Generate individual persona reviews (sequentially)
    const reviews: Array<{
      persona_id: string;
      persona_name: string;
      scores: any;
      review_text: string;
      strengths: string[];
      weaknesses: string[];
      llm_model: string;
    }> = [];

    for (const persona of personas as Persona[]) {
      const review = await generatePersonaReview(llm, persona, parsedData, rawInput);

      // Write review to DB immediately (for realtime updates)
      await supabase.from("persona_reviews").insert({
        evaluation_id: evaluationId,
        persona_id: persona.id,
        scores: review.scores,
        review_text: review.review_text,
        strengths: review.strengths,
        weaknesses: review.weaknesses,
        llm_model: review.llm_model,
      });

      reviews.push({
        persona_id: persona.id,
        persona_name: persona.identity.name,
        ...review,
      });

      // Report progress
      await job.updateProgress(
        Math.round((reviews.length / personas.length) * 80)
      );
    }

    // 5. Generate summary report
    const summaryReport = await generateSummaryReport(
      llm,
      parsedData,
      reviews,
      rawInput
    );

    // 6. Run scenario simulation (Max plan only)
    if (planTier === "max") {
      const simulation = await runScenarioSimulation(
        llm,
        personas as Persona[],
        reviews
      );
      summaryReport.scenario_simulation = simulation;
    }

    await job.updateProgress(95);

    // 7. Write summary report to DB
    await supabase.from("summary_reports").insert({
      evaluation_id: evaluationId,
      ...summaryReport,
    });

    // 8. Mark evaluation as completed
    await supabase
      .from("evaluations")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", evaluationId);

    await job.updateProgress(100);

    return { success: true, evaluationId };
  } catch (error) {
    // Mark as failed
    await supabase
      .from("evaluations")
      .update({ status: "failed" })
      .eq("id", evaluationId);

    throw error;
  }
}
```

- [ ] **Step 2: Create worker entry point**

Create `worker/src/index.ts`:
```typescript
import { createWorker } from "./queue.js";
import { processEvaluation } from "./processors/orchestrator.js";

console.log("Starting Persona evaluation worker...");

const worker = createWorker(processEvaluation);

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed for evaluation ${job.data.evaluationId}`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

worker.on("ready", () => {
  console.log("Worker is ready and listening for jobs.");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
});
```

- [ ] **Step 3: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add worker/src/processors/orchestrator.ts worker/src/index.ts
git commit -m "feat: add evaluation orchestrator and worker entry point"
```

---

### Task 9: Next.js API Routes — Evaluations

**Files:**
- Create: `src/app/api/evaluations/route.ts`, `src/app/api/evaluations/[id]/route.ts`

- [ ] **Step 1: Create evaluations list + create route**

Create `src/app/api/evaluations/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: projects } = await supabase
    .from("projects")
    .select(
      `
      id, raw_input, parsed_data, url, created_at,
      evaluations (
        id, status, selected_persona_ids, created_at, completed_at
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { rawInput, url, selectedPersonaIds } = body;

  if (!rawInput || !selectedPersonaIds?.length) {
    return NextResponse.json(
      { error: "rawInput and selectedPersonaIds are required" },
      { status: 400 }
    );
  }

  // Check subscription limits
  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!subscription) {
    return NextResponse.json({ error: "No subscription found" }, { status: 403 });
  }

  if (subscription.evaluations_used >= subscription.evaluations_limit) {
    return NextResponse.json(
      { error: "Monthly evaluation limit reached" },
      { status: 429 }
    );
  }

  // Check persona limit per plan
  const personaLimits = { free: 3, pro: 10, max: 20 };
  const maxPersonas = personaLimits[subscription.plan as keyof typeof personaLimits];
  if (selectedPersonaIds.length > maxPersonas) {
    return NextResponse.json(
      { error: `Maximum ${maxPersonas} personas allowed on ${subscription.plan} plan` },
      { status: 400 }
    );
  }

  // Create project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      raw_input: rawInput,
      url: url || null,
      parsed_data: {},
    })
    .select()
    .single();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }

  // Create evaluation
  const { data: evaluation, error: evalError } = await supabase
    .from("evaluations")
    .insert({
      project_id: project.id,
      selected_persona_ids: selectedPersonaIds,
      status: "pending",
    })
    .select()
    .single();

  if (evalError) {
    return NextResponse.json({ error: evalError.message }, { status: 500 });
  }

  // Increment usage
  await supabase
    .from("subscriptions")
    .update({ evaluations_used: subscription.evaluations_used + 1 })
    .eq("id", subscription.id);

  // Push job to queue (via internal API call to worker, or direct Redis)
  // For now, we'll use a simple fetch to a worker endpoint
  // In production, this would be a direct BullMQ queue push
  try {
    const { Queue } = await import("bullmq");
    const IORedis = (await import("ioredis")).default;
    const connection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
    });
    const queue = new Queue("evaluations", { connection });

    await queue.add("evaluate", {
      evaluationId: evaluation.id,
      projectId: project.id,
      rawInput,
      url: url || undefined,
      selectedPersonaIds,
      planTier: subscription.plan,
    });

    await connection.quit();
  } catch (queueError) {
    console.error("Failed to push to queue:", queueError);
    // Don't fail the request — evaluation is created, worker can pick it up later
  }

  return NextResponse.json({ project, evaluation }, { status: 201 });
}
```

- [ ] **Step 2: Create evaluation detail route**

Create `src/app/api/evaluations/[id]/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch evaluation with related data
  const { data: evaluation, error } = await supabase
    .from("evaluations")
    .select(
      `
      id, status, selected_persona_ids, created_at, completed_at,
      projects!inner (id, user_id, raw_input, parsed_data, url),
      persona_reviews (id, persona_id, scores, review_text, strengths, weaknesses, llm_model, created_at),
      summary_reports (*)
    `
    )
    .eq("id", id)
    .single();

  if (error || !evaluation) {
    return NextResponse.json({ error: "Evaluation not found" }, { status: 404 });
  }

  // Verify ownership
  const project = (evaluation as any).projects;
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ evaluation });
}
```

- [ ] **Step 3: Install BullMQ and ioredis in main project for queue pushing**

Run:
```bash
cd /Users/pinan/Desktop/persona
npm install bullmq ioredis
```

- [ ] **Step 4: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add src/app/api/evaluations/ package.json package-lock.json
git commit -m "feat: add evaluation API routes (create, list, detail)"
```

---

### Task 10: Next.js API Routes — Personas

**Files:**
- Create: `src/app/api/personas/route.ts`, `src/app/api/personas/recommend/route.ts`

- [ ] **Step 1: Create personas list route**

Create `src/app/api/personas/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  const { data: personas, error } = await supabase
    .from("personas")
    .select("id, identity, demographics, evaluation_lens, category")
    .eq("is_active", true)
    .order("category");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ personas });
}
```

- [ ] **Step 2: Create persona recommendation route**

Create `src/app/api/personas/recommend/route.ts`:
```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { projectDescription } = await request.json();

  if (!projectDescription) {
    return NextResponse.json(
      { error: "projectDescription is required" },
      { status: 400 }
    );
  }

  // Fetch all active personas
  const { data: personas } = await supabase
    .from("personas")
    .select("*")
    .eq("is_active", true);

  if (!personas?.length) {
    return NextResponse.json({ recommended_ids: [], reasoning: "No personas available" });
  }

  // Use LLM to recommend personas
  try {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    });

    const personaList = personas
      .map(
        (p: any) =>
          `- ID: ${p.id} | ${p.identity.name} | ${p.demographics.occupation} | Focus: ${p.evaluation_lens.primary_question}`
      )
      .join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a focus group coordinator. Given a project description and a list of available personas, recommend 5-8 of the most relevant personas.
Consider: target audience match, diverse perspectives, relevant expertise.
Respond ONLY with valid JSON: { "recommended_ids": ["id1", "id2", ...], "reasoning": "brief explanation" }`,
      messages: [
        {
          role: "user",
          content: `Project: ${projectDescription}\n\nAvailable personas:\n${personaList}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is { type: "text"; text: string } => b.type === "text")
      .map((b) => b.text)
      .join("");

    const result = JSON.parse(text);
    return NextResponse.json(result);
  } catch (error) {
    // Fallback: return first 5 personas
    return NextResponse.json({
      recommended_ids: personas.slice(0, 5).map((p: any) => p.id),
      reasoning: "Default recommendation (LLM unavailable)",
    });
  }
}
```

- [ ] **Step 3: Add ANTHROPIC_API_KEY to main .env.local**

Append to `/Users/pinan/Desktop/persona/.env.local`:
```
ANTHROPIC_API_KEY=your_anthropic_api_key
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 4: Install @anthropic-ai/sdk in main project**

Run:
```bash
cd /Users/pinan/Desktop/persona
npm install @anthropic-ai/sdk
```

- [ ] **Step 5: Commit**

```bash
cd /Users/pinan/Desktop/persona
git add src/app/api/personas/ package.json package-lock.json
git commit -m "feat: add persona API routes (list, recommend)"
```

---

### Task 11: Final Verification + Build Check

**Files:**
- None new

- [ ] **Step 1: Verify worker compiles**

Run:
```bash
cd /Users/pinan/Desktop/persona/worker
npx tsc --noEmit
```

Fix any TypeScript errors found.

- [ ] **Step 2: Run worker tests**

Run:
```bash
cd /Users/pinan/Desktop/persona/worker
npx vitest run
```

All tests should pass.

- [ ] **Step 3: Verify main project builds**

Run:
```bash
cd /Users/pinan/Desktop/persona
npm run build
```

Fix any build errors found.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
cd /Users/pinan/Desktop/persona
git add -A
git commit -m "fix: resolve build issues — Plan 2 complete"
```

---

## Summary

Plan 2 delivers:
- Worker project with BullMQ + Redis job queue
- LLM adapter layer (abstract interface + Claude Sonnet 4.6 implementation)
- 12 pre-built personas with full 11-layer model
- Project parser (LLM extracts structured data from user input)
- Persona review generator (LLM generates review per persona, in character)
- Summary report generator (comprehensive product diagnosis)
- Scenario simulation (Max plan: social influence dynamics)
- Evaluation orchestrator (coordinates full pipeline: parse → review → report)
- Next.js API routes (evaluations CRUD, persona list, persona recommendation)

**Next:** Plan 3 (Frontend) builds the actual UI pages on this backend.
