import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText, Output, type LanguageModel } from "ai";
import { BooksSchema, type Book } from "./schema";

// Serce projektu. OpenRouter to bramka (AI gateway): jeden klucz API i jedno API
// do modeli wielu firm (Anthropic, Google, OpenAI…). Zmiana modelu = zmiana jednego napisu.

export type ExtractResult = {
  model: string;
  provider: string | undefined; // który dostawca faktycznie obsłużył zapytanie
  books: Book[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number | undefined; // koszt podany przez OpenRouter
  seconds: number;
};

const INSTRUCTIONS =
  "Jesteś precyzyjnym ekstraktorem danych ze stron internetowych. " +
  "Zwracasz wyłącznie dane obecne w podanym HTML. Niczego nie wymyślasz i nie pomijasz rekordów.";

export function openRouterModel(modelId: string, apiKey: string | undefined): LanguageModel {
  if (!apiKey) {
    throw new Error("Brak OPENROUTER_API_KEY. Skopiuj .env.example jako .env i wpisz swój klucz z openrouter.ai/keys");
  }
  const openrouter = createOpenRouter({ apiKey, appName: "scraper-ai" });
  return openrouter(modelId, {
    usage: { include: true }, // OpenRouter zwróci koszt zapytania w dolarach
    plugins: [{ id: "response-healing" }], // naprawia drobne usterki w JSON od modelu
  });
}

export async function extractBooks(model: LanguageModel, cleanedHtml: string): Promise<ExtractResult> {
  const started = performance.now();

  const result = await generateText({
    model,
    output: Output.object({ schema: BooksSchema, name: "books" }), // format + walidacja Zod
    instructions: INSTRUCTIONS,
    prompt: `Wyciągnij wszystkie książki z poniższego fragmentu strony.\n\nHTML:\n${cleanedHtml}`,
    temperature: 0, // model ma być dokładny, nie kreatywny
    maxOutputTokens: 8_000,
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(120_000),
  });

  const meta = result.providerMetadata?.openrouter as { provider?: string; usage?: { cost?: number } } | undefined;

  return {
    model: typeof model === "string" ? model : model.modelId,
    provider: meta?.provider || undefined,
    books: result.output.books, // gotowe dane, już sprawdzone przez Zod
    inputTokens: result.usage.inputTokens ?? 0,
    outputTokens: result.usage.outputTokens ?? 0,
    costUsd: meta?.usage?.cost,
    seconds: (performance.now() - started) / 1000,
  };
}
