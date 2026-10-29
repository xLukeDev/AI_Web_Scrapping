import { z } from "zod";

// Ustawienia programu. Wszystko można nadpisać w pliku .env (Bun wczytuje go sam)
// albo flagami w wierszu poleceń. Zod sprawdza też konfigurację – literówka w .env
// kończy się czytelnym komunikatem, a nie dziwnym błędem w połowie działania.

export const DEFAULT_URL = "https://books.toscrape.com/";
export const DEFAULT_MODEL = "anthropic/claude-haiku-5.5";
export const DEFAULT_BENCH_MODELS = [
  "anthropic/claude-haiku-5.5", // tani i szybki – model domyślny
  "anthropic/claude-sonnet-5.5", // mocny, kilkadziesiąt razy droższy
  "google/gemini-2.5-flash-lite", // bardzo tani konkurent
  "openai/gpt-5.6-luna", // tani model OpenAI
];

const modelList = z
  .string()
  .transform((s) => s.split(",").map((m) => m.trim()).filter(Boolean))
  .pipe(z.array(z.string()).min(1, "podaj co najmniej jeden model"));

const EnvSchema = z.object({
  OPENROUTER_API_KEY: z.string().optional(),
  MODEL: z.string().default(DEFAULT_MODEL),
  BENCH_MODELS: modelList.default(DEFAULT_BENCH_MODELS),
  BENCH_RUNS: z.coerce.number().int().min(1).max(10).default(1),
  TARGET_URL: z.url({ protocol: /^https?$/ }).default(DEFAULT_URL),
  ROOT_SELECTOR: z.string().default("section"),
});

export type Config = {
  apiKey: string | undefined;
  model: string;
  benchModels: string[];
  benchRuns: number;
  url: string;
  rootSelector: string;
  userAgent: string;
};

export function loadConfig(env: Record<string, string | undefined> = Bun.env): Config {
  // Puste wpisy z .env (np. "MODEL=") traktujemy jak brak wartości
  const filled = Object.fromEntries(Object.entries(env).filter(([, v]) => v?.trim()));
  const parsed = EnvSchema.safeParse(filled);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Błędna konfiguracja w .env:\n${issues}`);
  }

  const e = parsed.data;
  return {
    apiKey: e.OPENROUTER_API_KEY?.trim(),
    model: e.MODEL,
    benchModels: e.BENCH_MODELS,
    benchRuns: e.BENCH_RUNS,
    url: e.TARGET_URL,
    rootSelector: e.ROOT_SELECTOR,
    userAgent: "Mozilla/5.0 (compatible; scraper-ai/2.0; projekt studencki)",
  };
}
