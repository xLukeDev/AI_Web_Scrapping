import * as cheerio from "cheerio";
import type { Config } from "./config";
import { fetchPage } from "./fetchPage";
import type { Book } from "./schema";
import { bold, dim, printBooks } from "./ui";

// Klasyczny scraping bez AI: ręcznie napisane selektory CSS.
// Szybki i darmowy, ale psuje się, gdy strona zmieni wygląd.
// Jego wynik to nasz „wzorzec prawdy” przy ocenie modeli AI.

const RATING_WORDS: Record<string, number> = { One: 1, Two: 2, Three: 3, Four: 4, Five: 5 };

export function scrapeClassic(html: string): Book[] {
  const $ = cheerio.load(html);

  return $("article.product_pod")
    .map((_, el) => {
      const card = $(el);
      const ratingClass = card.find(".star-rating").attr("class")?.split(/\s+/).find((c) => c in RATING_WORDS);

      return {
        title: card.find("h3 a").attr("title") ?? "",
        price: Number.parseFloat(card.find(".price_color").text().replace(/[^\d.]/g, "")),
        currency: "GBP",
        rating: ratingClass ? RATING_WORDS[ratingClass]! : 0,
        inStock: card.find(".availability").text().includes("In stock"),
      };
    })
    .get();
}

// scraper-ai classic – nie wymaga klucza API
export async function runClassic(config: Config): Promise<void> {
  const started = performance.now();
  const html = await fetchPage(config.url, config.userAgent);
  const books = scrapeClassic(html);
  const ms = performance.now() - started;

  printBooks(books);
  console.log(`\n${bold(`${books.length} książek`)} bez AI w ${ms.toFixed(0)} ms ` + dim("(koszt: $0)"));
  if (!books.length) console.log("Selektory CSS nic nie znalazły – strona ma inny układ niż books.toscrape.com.");
}
