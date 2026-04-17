import http from "node:http";
import { buildLLM, type LLMOverrides } from "./llm/factory.js";
import { log } from "./utils/logger.js";

type PersonaSummary = {
  id: string;
  name: string;
  occupation: string;
  primary_question: string;
};

type RecommendBody = {
  projectDescription?: string;
  personas?: PersonaSummary[];
  llmOverrides?: LLMOverrides;
};

async function handleRecommend(body: RecommendBody): Promise<{ recommended_ids: string[]; reasoning: string }> {
  const projectDescription = body.projectDescription?.trim();
  const personas = body.personas ?? [];
  const llm = buildLLM(body.llmOverrides);

  if (!projectDescription) {
    const err = new Error("projectDescription required");
    (err as Error & { statusCode?: number }).statusCode = 400;
    throw err;
  }
  if (!personas.length) {
    return { recommended_ids: [], reasoning: "No personas available" };
  }

  const personaList = personas
    .map((p) => `- ID: ${p.id} | ${p.name} | ${p.occupation} | Focus: ${p.primary_question}`)
    .join("\n");

  const response = await llm.complete({
    system:
      'You are a focus group coordinator. Given a project description and a list of available personas, recommend 5-8 of the most relevant personas.\nConsider: target audience match, diverse perspectives, relevant expertise.\nRespond ONLY with valid JSON: { "recommended_ids": ["id1", "id2", ...], "reasoning": "brief explanation" }',
    prompt: `Project: ${projectDescription}\n\nAvailable personas:\n${personaList}`,
    maxTokens: 1024,
    jsonMode: true,
  });

  const parsed = JSON.parse(response.text) as { recommended_ids?: string[]; reasoning?: string };
  return {
    recommended_ids: Array.isArray(parsed.recommended_ids) ? parsed.recommended_ids : [],
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };
}

async function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalLength = 0;
    req.on("data", (chunk: Buffer) => {
      totalLength += chunk.length;
      if (totalLength > 1_000_000) {
        reject(Object.assign(new Error("payload too large"), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error("invalid json"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

export function startHttpServer(): http.Server {
  const port = Number(process.env.PORT ?? 8080);
  const sharedSecret = process.env.WORKER_SHARED_SECRET ?? "";

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method !== "POST" || req.url !== "/recommend") {
      sendJson(res, 404, { error: "not found" });
      return;
    }

    if (!sharedSecret || req.headers["x-worker-secret"] !== sharedSecret) {
      sendJson(res, 401, { error: "unauthorized" });
      return;
    }

    const started = Date.now();
    try {
      const body = (await readJsonBody(req)) as RecommendBody;
      const result = await handleRecommend(body);
      log.info("http.recommend", {
        durationMs: Date.now() - started,
        personaCount: body.personas?.length ?? 0,
        recommendedCount: result.recommended_ids.length,
      });
      sendJson(res, 200, result);
    } catch (err) {
      const statusCode = (err as Error & { statusCode?: number }).statusCode ?? 500;
      const message = err instanceof Error ? err.message : String(err);
      log.error("http.recommend.failed", { durationMs: Date.now() - started, statusCode, error: message });
      sendJson(res, statusCode, { error: message });
    }
  });

  server.listen(port, () => {
    log.info("http.listening", { port });
  });

  return server;
}
