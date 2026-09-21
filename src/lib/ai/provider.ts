/**
 * AI provider abstraction.
 *
 * The rest of the app talks to `chatComplete()` / `embed()` only — never
 * to a specific vendor SDK. That keeps model choice swappable and lets
 * the app run in a clean "dev fallback" mode when AI_PROVIDER_KEY is
 * unset, instead of throwing on every request.
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompleteResult {
  content: string;
  usedFallback: boolean;
}

export interface AIProvider {
  chatComplete(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<ChatCompleteResult>;
  embed(texts: string[]): Promise<number[][]>;
}

class AnthropicProvider implements AIProvider {
  constructor(private apiKey: string) {}

  async chatComplete(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<ChatCompleteResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages.filter((m) => m.role !== "system");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: opts?.maxTokens ?? 800,
        system,
        messages: rest.map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    if (!res.ok) {
      throw new Error(`AI provider error: ${res.status} ${await res.text()}`);
    }

    const data = await res.json();
    const text = data.content
      ?.filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text)
      .join("\n") ?? "";

    return { content: text, usedFallback: false };
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Swap in a real embeddings provider (OpenAI text-embedding-3-small,
    // Voyage, Cohere, etc.) here. Kept separate from chatComplete's
    // vendor so embeddings and generation can use different providers.
    throw new Error("No embeddings provider configured — set EMBEDDING_PROVIDER_KEY");
  }
}

class GeminiProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private chatModel: string,
    private embeddingModel: string,
  ) {}

  async chatComplete(messages: ChatMessage[], opts?: { maxTokens?: number }): Promise<ChatCompleteResult> {
    const system = messages.find((m) => m.role === "system")?.content;
    const rest = messages.filter((m) => m.role !== "system");

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.chatModel}:generateContent`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          contents: rest.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          })),
          generationConfig: { maxOutputTokens: opts?.maxTokens ?? 800 },
        }),
      },
    );

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      // Expose only the HTTP status and Google error category. Avoid logging
      // response bodies, request headers or credentials in application logs.
      const category = typeof payload?.error?.status === "string" && /^[A-Z_]{3,64}$/.test(payload.error.status)
        ? payload.error.status
        : "UNKNOWN";
      throw new Error(`Gemini chat API error: ${res.status} ${category}`);
    }

    const data = await res.json();
    const text: string =
      data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";

    return { content: text, usedFallback: false };
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Requests exactly 1536 dimensions to match the fixed
    // `vector(1536)` column in schema.prisma (KnowledgeChunk.embedding).
    // Verify your chosen embedding model actually supports
    // outputDimensionality=1536 (this is written against
    // gemini-embedding-001's documented Matryoshka truncation support —
    // confirm against Google's current API docs, since this couldn't be
    // tested against a live endpoint here). If you use a different
    // embedding model/dimension, update the column type in
    // schema.prisma AND the migration to match, or inserts will fail.
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:batchEmbedContents`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
        body: JSON.stringify({
          requests: texts.map((text) => ({
            model: `models/${this.embeddingModel}`,
            content: { parts: [{ text }] },
            outputDimensionality: 1536,
          })),
        }),
      },
    );

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      // Expose only the HTTP status and Google error category. Avoid logging
      // response bodies, request headers or credentials in application logs.
      const category = typeof payload?.error?.status === "string" && /^[A-Z_]{3,64}$/.test(payload.error.status)
        ? payload.error.status
        : "UNKNOWN";
      throw new Error(`Gemini embeddings API error: ${res.status} ${category}`);
    }

    const data = await res.json();
    return data.embeddings.map((e: { values: number[] }) => e.values);
  }
}

/**
 * Deterministic, zero-dependency fallback so the app is fully clickable
 * without any API key configured. Never used if AI_PROVIDER_KEY is set.
 */
class DevFallbackProvider implements AIProvider {
  async chatComplete(messages: ChatMessage[]): Promise<ChatCompleteResult> {
    const lastUser = [...messages].reverse().find((m) => m.role === "user")?.content ?? "";
    return {
      content:
        `[DEV MODE — no AI provider configured]\n\n` +
        `I would normally answer using your knowledge base here. ` +
        `You asked: "${lastUser.slice(0, 200)}"`,
      usedFallback: true,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    // Deterministic pseudo-embedding (hash-based) purely so retrieval
    // code paths and UI are exercisable without a real provider. NOT
    // semantically meaningful — replace before any real usage.
    return texts.map((t) => {
      const vec = new Array(1536).fill(0);
      for (let i = 0; i < t.length; i++) {
        vec[t.charCodeAt(i) % 1536] += 1;
      }
      return vec;
    });
  }
}

let cached: AIProvider | null = null;

export function getAIProvider(): AIProvider {
  if (cached) return cached;

  // AI_PROVIDER picks explicitly when both keys might be present;
  // otherwise whichever key exists decides.
  const preferred = process.env.AI_PROVIDER; // "anthropic" | "gemini" | undefined
  const anthropicKey = process.env.AI_PROVIDER_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  if (preferred === "gemini" || (!preferred && !anthropicKey && geminiKey)) {
    if (!geminiKey) throw new Error("AI_PROVIDER=gemini requires GEMINI_API_KEY to be set.");
    cached = new GeminiProvider(
      geminiKey,
      process.env.GEMINI_CHAT_MODEL ?? "gemini-2.5-flash",
      process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
    );
    return cached;
  }

  if (anthropicKey) {
    cached = new AnthropicProvider(anthropicKey);
    return cached;
  }

  // A silent dev fallback in production means customers see canned
  // placeholder replies with no error anywhere — fail loudly instead so
  // a missing key is caught at deploy time, not discovered by a
  // customer getting "[DEV MODE]" as an answer.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "No AI provider configured (set AI_PROVIDER_KEY or GEMINI_API_KEY) and NODE_ENV=production — refusing to silently fall back to dev mode.",
    );
  }

  cached = new DevFallbackProvider();
  return cached;
}
