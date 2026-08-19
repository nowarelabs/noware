import { WorkerEntrypoint } from "cloudflare:workers";

interface Env {
  // Tool-specific secrets and credentials are injected here as bindings.
  [key: string]: unknown;
}

interface AiBinding {
  run(model: string, inputs: Record<string, unknown>): Promise<any>;
}

const POSITIVE = new Set(["good", "great", "amazing", "excellent", "love", "loved", "awesome", "happy", "helpful", "fast", "easy", "clear", "works", "thank", "thanks", "perfect", "best", "like", "liked", "impressive", "intuitive", "smooth", "recommend"]);
const NEGATIVE = new Set(["bad", "terrible", "awful", "hate", "hated", "sad", "slow", "broken", "bug", "bugs", "crash", "crashes", "confusing", "worst", "disappointing", "frustrating", "useless", "error", "fails", "failed", "not working", "waste", "poor", "horrible", "dislike"]);
const NEGATE = new Set(["not", "no", "never", "neither", "hardly", "barely", "without"]);

function lexiconScore(text: string): number {
  const words = text.toLowerCase().replace(/[^a-z0-9'\s-]/g, " ").split(/\s+/);
  let score = 0;
  let negateNext = false;
  for (const word of words) {
    if (NEGATE.has(word)) {
      negateNext = true;
      continue;
    }
    let delta = 0;
    if (POSITIVE.has(word)) delta = 1;
    else if (NEGATIVE.has(word)) delta = -1;
    if (negateNext) delta = -delta;
    score += delta;
    negateNext = false;
  }
  const max = Math.max(1, words.length);
  return Math.max(-1, Math.min(1, score / max));
}

const TOPIC_KEYWORDS: Record<string, string[]> = {
  performance: ["slow", "fast", "speed", "latency", "performance", "crash", "hang"],
  reliability: ["crash", "crashes", "broken", "bug", "error", "fails", "failed", "down", "offline"],
  usability: ["confusing", "intuitive", "easy", "difficult", "hard", "useless", "clear", "smooth"],
  pricing: ["price", "expensive", "cheap", "cost", "free", "money", "worth"],
  features: ["feature", "missing", "wish", "would like", "add", "support"],
  support: ["help", "support", "docs", "documentation", "thanks", "thank"],
};

function dominantTopic(text: string): string {
  const lower = text.toLowerCase();
  let best = "other";
  let bestCount = 0;
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const count = keywords.reduce((n, k) => n + (lower.includes(k) ? 1 : 0), 0);
    if (count > bestCount) {
      bestCount = count;
      best = topic;
    }
  }
  return best;
}

export class SentimentAnalysisTool extends WorkerEntrypoint<Env> {
  async analyzeSentiment(input: { text: string }): Promise<{ sentiment: string; score: number }> {
    const ai = this.env.AI as AiBinding | undefined;
    if (ai) {
      try {
        const result = await ai.run("@cf/huggingface/distilbert-sst-2-int8", { text: input.text });
        const results = result?.results ?? [];
        const best = results.reduce((a: any, b: any) => (b.score > a.score ? b : a), results[0] ?? {});
        if (best?.label) {
          return { sentiment: best.label.toLowerCase(), score: Math.round(best.score * 100) / 100 };
        }
      } catch {
        // fall back to lexicon
      }
    }

    const score = lexiconScore(input.text);
    const sentiment = score > 0.1 ? "positive" : score < -0.1 ? "negative" : "neutral";
    return { sentiment, score: Math.round(score * 100) / 100 };
  }

  async clusterFeedback(input: { items: string[] }): Promise<unknown> {
    const clusters = new Map<string, { sentiment: string; score: number; averageScore: number; items: string[] }>();
    for (const item of input.items) {
      const topic = dominantTopic(item);
      const { sentiment, score } = await this.analyzeSentiment({ text: item });
      const entry = clusters.get(topic) ?? { sentiment, score, averageScore: 0, items: [] };
      entry.items.push(item);
      entry.score = (entry.score + score) / 2;
      entry.averageScore = entry.score;
      clusters.set(topic, entry);
    }
    return [...clusters.entries()].map(([topic, cluster]) => ({
      topic,
      itemCount: cluster.items.length,
      averageScore: Math.round(cluster.score * 100) / 100,
      sentiment: cluster.averageScore > 0.1 ? "positive" : cluster.averageScore < -0.1 ? "negative" : "neutral",
      items: cluster.items.slice(0, 20),
    }));
  }
}

export default {
  async fetch(): Promise<Response> {
    return new Response(
      "This worker is only callable via RPC service binding.",
      { status: 400 },
    );
  },
};
