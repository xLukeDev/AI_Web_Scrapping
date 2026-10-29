// bun run snapshot – odświeża kopię strony books.toscrape.com używaną w testach
import { DEFAULT_URL } from "../src/config";

const res = await fetch(DEFAULT_URL, { signal: AbortSignal.timeout(15_000) });
if (!res.ok) throw new Error(`HTTP ${res.status} dla ${DEFAULT_URL}`);

const html = await res.text();
await Bun.write(new URL("../test/fixtures/books-toscrape.txt", import.meta.url), html);
console.log(`Zapisano ${html.length} znaków do test/fixtures/books-toscrape.txt`);
