import { mkdir } from "node:fs/promises";
import { NoObjectGeneratedError } from "ai";
import { scoreAccuracy } from "./accuracy";
import { scrapeClassic } from "./classic";
import { cleanHtml } from "./clean";
import type { Config } from "./config";
import { extractBooks, openRouterModel } from "./extract";
import { fetchPage } from "./fetchPage";
import { dim, green, int, pct, printTable, red, toMarkdownTable, usd, type Column } from "./ui";

// scraper-ai bench – ten sam fragment strony trafia do kilku modeli.
// Porównujemy czas, tokeny, koszt (z OpenRouter) i trafność względem scrapera klasycznego.

type Run = { seconds: number; inTok: number; outTok: number; cost?: number; accuracy: number; found: number };

export type BenchRow = {
  model: string;
  runs: number;
  seconds?: number;
  inTok?: number;
  outTok?: number;
  cost?: number;
  accuracy?: number;
  found: string;
  formatErrors: number; // odpowiedź niezgodna ze schematem Zod
  apiErrors: number; // błąd sieci, limitu, nieznany model itp.
};

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined);
const fmt = (v: number | undefined, f: (n: number) => string) => (v === undefined ? "–" : f(v));

const COLUMNS: Column<BenchRow>[] = [
  { header: "Model", value: (r) => r.model },
  { header: "Czas [s]", value: (r) => fmt(r.seconds, (v) => v.toFixed(1)), align: "right" },
  { header: "Tokeny we", value: (r) => fmt(r.inTok, int), align: "right" },
  { header: "Tokeny wy", value: (r) => fmt(r.outTok, int), align: "right" },
  { header: "Koszt 1 strony", value: (r) => usd(r.cost), align: "right" },
  { header: "Koszt 1000 stron", value: (r) => usd(r.cost === undefined ? undefined : r.cost * 1000, 2), align: "right" },
  { header: "Trafność", value: (r) => fmt(r.accuracy, pct), align: "right" },
  { header: "Znalezione", value: (r) => r.found, align: "right" },
  { header: "Błędy formatu", value: (r) => r.formatErrors, align: "right" },
  { header: "Błędy API", value: (r) => r.apiErrors, align: "right" },
];

export async function runBench(
  config: Config,
  opts: { models?: string[]; runs?: number } = {},
): Promise<BenchRow[]> {
  const models = opts.models ?? config.benchModels;
  const runsPerModel = opts.runs ?? config.benchRuns;
  openRouterModel(models[0]!, config.apiKey); // od razu sprawdza, czy jest klucz

  const html = await fetchPage(config.url, config.userAgent);
  const cleaned = cleanHtml(html, config.rootSelector);
  const truth = scrapeClassic(html); // wzorzec poprawnych danych

  console.log(
    `Strona: ${config.url} · wzorzec: ${truth.length} książek · ` +
      `modele: ${models.length} · powtórzenia: ${runsPerModel}\n`,
  );

  const rows: BenchRow[] = [];

  // Modele odpytujemy po kolei, żeby pomiar czasu był uczciwy
  for (const modelId of models) {
    const runs: Run[] = [];
    let formatErrors = 0;
    let apiErrors = 0;

    for (let i = 1; i <= runsPerModel; i++) {
      const label = `${modelId} (${i}/${runsPerModel})`;
      try {
        const r = await extractBooks(openRouterModel(modelId, config.apiKey), cleaned);
        const score = scoreAccuracy(truth, r.books);
        runs.push({
          seconds: r.seconds,
          inTok: r.inputTokens,
          outTok: r.outputTokens,
          cost: r.costUsd,
          accuracy: score.accuracy,
          found: score.found,
        });
        console.log(`${green("✓")} ${label}: ${r.seconds.toFixed(1)} s, ${usd(r.costUsd)}, trafność ${pct(score.accuracy)}`);
      } catch (err) {
        const isFormat = NoObjectGeneratedError.isInstance(err);
        if (isFormat) formatErrors++;
        else apiErrors++;
        const reason = (err as Error).message.split("\n")[0]!.slice(0, 120);
        console.log(`${red("✗")} ${label}: ${isFormat ? "błąd formatu" : "błąd API"} – ${reason}`);
      }
    }

    const costs = runs.flatMap((r) => (r.cost === undefined ? [] : [r.cost]));
    const found = avg(runs.map((r) => r.found));
    rows.push({
      model: modelId,
      runs: runs.length,
      seconds: avg(runs.map((r) => r.seconds)),
      inTok: avg(runs.map((r) => r.inTok)),
      outTok: avg(runs.map((r) => r.outTok)),
      cost: avg(costs),
      accuracy: avg(runs.map((r) => r.accuracy)),
      found: found === undefined ? "–" : `${Math.round(found)}/${truth.length}`,
      formatErrors,
      apiErrors,
    });
  }

  console.log();
  printTable(rows, COLUMNS);

  // Zapis: JSON z surowymi liczbami + gotowa tabela Markdown na slajd
  const date = new Date();
  const markdown = [
    "# Porównanie modeli AI – ekstrakcja danych",
    "",
    `- Data: ${date.toLocaleString("pl-PL")}`,
    `- Strona: ${config.url}, wzorzec: ${truth.length} książek ze scrapera klasycznego`,
    `- Powtórzenia na model: ${runsPerModel} (wyniki uśrednione)`,
    "",
    toMarkdownTable(rows, COLUMNS),
    "",
  ].join("\n");

  await mkdir("data", { recursive: true });
  await Bun.write("data/bench.json", JSON.stringify({ date: date.toISOString(), url: config.url, runsPerModel, rows }, null, 2));
  await Bun.write("data/bench.md", markdown);
  console.log(dim(`\nZapisano data/bench.md i data/bench.json`));
  return rows;
}
