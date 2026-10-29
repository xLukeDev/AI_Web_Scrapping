import { describe, expect, test } from "bun:test";
import { NoObjectGeneratedError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { scoreAccuracy } from "../src/accuracy";
import { scrapeClassic } from "../src/classic";
import { cleanHtml, estimateTokens } from "../src/clean";
import { loadConfig } from "../src/config";
import { extractBooks } from "../src/extract";
import { isPathAllowed, parseRobots } from "../src/fetchPage";
import type { Book } from "../src/schema";
// Zapisana kopia books.toscrape.com, żeby testy nie zależały od internetu (odświeżenie: bun run snapshot)
import snapshot from "./fixtures/books-toscrape.txt" with { type: "text" };

const truth = scrapeClassic(snapshot);

function mockModel(text: string, cost = 0.00042) {
  return new MockLanguageModelV4({
    modelId: "test/mock",
    doGenerate: {
      content: [{ type: "text", text }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: {
        inputTokens: { total: 1234, noCache: 1234, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 567, text: 567, reasoning: 0 },
      },
      providerMetadata: { openrouter: { provider: "Mock", usage: { cost } } },
      warnings: [],
    },
  });
}

describe("classic", () => {
  test("wyciąga 20 książek z kopii strony", () => {
    expect(truth).toHaveLength(20);
    expect(truth[0]).toEqual({ title: "A Light in the Attic", price: 51.77, currency: "GBP", rating: 3, inStock: true });
    expect(truth.every((b) => b.rating >= 1 && b.rating <= 5 && b.price > 0)).toBe(true);
  });
});

describe("clean", () => {
  const cleaned = cleanHtml(snapshot, "section");

  test("usuwa skrypty i zbędne atrybuty, zostawia dane", () => {
    expect(cleaned).not.toContain("<script");
    expect(cleaned).not.toContain("href=");
    expect(cleaned).toContain('title="A Light in the Attic"');
    expect(cleaned).toContain("star-rating Three");
    expect(cleaned).toContain("£51.77");
  });

  test("zmniejsza liczbę tokenów kilkukrotnie", () => {
    expect(estimateTokens(snapshot) / estimateTokens(cleaned)).toBeGreaterThan(3);
  });
});

describe("accuracy", () => {
  test("100% dla identycznych danych", () => {
    expect(scoreAccuracy(truth, truth)).toEqual({ accuracy: 1, found: 20, expected: 20, extra: 0 });
  });

  test("liczy błędne pola, brakujące i nadmiarowe rekordy", () => {
    const wrongPrice = truth.slice(0, 10).map((b, i) => (i === 0 ? { ...b, price: 1 } : b));
    const invented: Book = { title: "Nie istnieje", price: 1, currency: "GBP", rating: 1, inStock: true };
    const score = scoreAccuracy(truth, [...wrongPrice, invented]);
    expect(score.found).toBe(10);
    expect(score.extra).toBe(1);
    expect(score.accuracy).toBeCloseTo((10 * 4 - 1) / 80);
  });
});

describe("extract (atrapa modelu, bez klucza API)", () => {
  test("zwraca dane sprawdzone przez Zod, tokeny i koszt z OpenRouter", async () => {
    const result = await extractBooks(mockModel(JSON.stringify({ books: truth })), "<html/>");
    expect(result.books).toEqual(truth);
    expect(result.inputTokens).toBe(1234);
    expect(result.outputTokens).toBe(567);
    expect(result.costUsd).toBe(0.00042);
    expect(result.provider).toBe("Mock");
    expect(result.model).toBe("test/mock");
  });

  test("odrzuca odpowiedź niezgodną ze schematem", async () => {
    const bad = JSON.stringify({ books: [{ title: "X", price: "drogo", currency: "GBP", rating: 3, inStock: true }] });
    const err = await extractBooks(mockModel(bad), "<html/>").catch((e: unknown) => e);
    expect(NoObjectGeneratedError.isInstance(err)).toBe(true);
  });

  test("wysyła schemat JSON i temperature 0", async () => {
    const model = mockModel(JSON.stringify({ books: [] }));
    await extractBooks(model, "<p>html</p>");
    const call = model.doGenerateCalls[0]!;
    expect(call.temperature).toBe(0);
    expect(call.responseFormat).toMatchObject({ type: "json", name: "books" });
    expect(JSON.stringify(call.prompt)).toContain("<p>html</p>");
  });
});

describe("robots.txt", () => {
  const robots = `
User-agent: *
Disallow: /private/
Allow: /private/public$

User-agent: scraper-ai
Disallow: /tylko-dla-nas/
`;

  test("wybiera grupę naszego bota", () => {
    const rules = parseRobots(robots, "scraper-ai");
    expect(isPathAllowed(rules, "/tylko-dla-nas/x")).toBe(false);
    expect(isPathAllowed(rules, "/private/x")).toBe(true);
  });

  test("grupa * i najdłuższa reguła", () => {
    const rules = parseRobots(robots, "inny-bot");
    expect(isPathAllowed(rules, "/")).toBe(true);
    expect(isPathAllowed(rules, "/private/x")).toBe(false);
    expect(isPathAllowed(rules, "/private/public")).toBe(true);
    expect(isPathAllowed(rules, "/private/public/x")).toBe(false);
  });
});

describe("config", () => {
  test("puste wpisy z .env dostają wartości domyślne", () => {
    const c = loadConfig({ OPENROUTER_API_KEY: "", MODEL: "  ", BENCH_MODELS: "a/b, c/d ," });
    expect(c.apiKey).toBeUndefined();
    expect(c.model).toBe("anthropic/claude-haiku-5.5");
    expect(c.benchModels).toEqual(["a/b", "c/d"]);
  });

  test("błędna konfiguracja daje czytelny komunikat", () => {
    expect(() => loadConfig({ BENCH_RUNS: "zero" })).toThrow(/BENCH_RUNS/);
  });
});
