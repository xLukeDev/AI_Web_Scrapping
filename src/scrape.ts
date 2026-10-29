import { mkdir } from "node:fs/promises";
import { scoreAccuracy } from "./accuracy";
import { scrapeClassic } from "./classic";
import { cleanHtml, estimateTokens } from "./clean";
import type { Config } from "./config";
import { extractBooks, openRouterModel } from "./extract";
import { fetchPage, isAllowedByRobots } from "./fetchPage";
import { bold, cyan, dim, green, int, pct, printBooks, usd, yellow } from "./ui";

// scraper-ai scrape – pełny przepływ:
// robots.txt → pobranie strony → Cheerio czyści HTML → model AI (OpenRouter) → Zod → JSON
export async function runScrape(config: Config, opts: { model?: string } = {}): Promise<void> {
  const modelId = opts.model ?? config.model;
  const model = openRouterModel(modelId, config.apiKey); // od razu sprawdza, czy jest klucz

  if (!(await isAllowedByRobots(config.url, config.userAgent))) {
    throw new Error(`robots.txt nie pozwala pobierać ${config.url} – przerywam.`);
  }

  console.log(`${cyan("1/3")} Pobieram ${config.url}`);
  const html = await fetchPage(config.url, config.userAgent);
  const cleaned = cleanHtml(html, config.rootSelector);
  console.log(
    `${cyan("2/3")} Czyszczę HTML: ${int(html.length)} → ${int(cleaned.length)} znaków ` +
      dim(`(~${int(estimateTokens(html))} → ~${int(estimateTokens(cleaned))} tokenów)`),
  );

  console.log(`${cyan("3/3")} Wysyłam do modelu ${bold(modelId)}…\n`);
  const result = await extractBooks(model, cleaned);

  printBooks(result.books);

  const score = scoreAccuracy(scrapeClassic(html), result.books);
  const scoreColor = score.accuracy >= 0.95 ? green : yellow;
  console.log(
    `\n${bold(`${result.books.length} książek`)} w ${result.seconds.toFixed(1)} s · ` +
      `tokeny: ${int(result.inputTokens)} we / ${int(result.outputTokens)} wy · ` +
      `koszt: ${bold(usd(result.costUsd))}` +
      dim(result.provider ? ` (dostawca: ${result.provider})` : ""),
  );
  console.log(
    `Trafność względem scrapera klasycznego: ${scoreColor(pct(score.accuracy))} ` +
      dim(`(znalezione ${score.found}/${score.expected}, nadmiarowe: ${score.extra})`),
  );

  await mkdir("data", { recursive: true });
  await Bun.write("data/books.json", JSON.stringify(result.books, null, 2));
  console.log(dim("Zapisano data/books.json"));
}
