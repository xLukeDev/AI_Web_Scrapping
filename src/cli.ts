import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { runBench } from "./bench";
import { runClassic } from "./classic";
import { loadConfig } from "./config";
import { runScrape } from "./scrape";
import { bold, cyan, dim, red } from "./ui";
import pkg from "../package.json";

// Wspólny punkt wejścia: `bun run src/cli.ts …` oraz skompilowany plik scraper-ai.exe.
// Klucz API NIE jest wbudowany w .exe – program czyta go z pliku .env.

const HELP = `
${bold("scraper-ai")} ${pkg.version} – pobieranie danych ze stron z pomocą AI
${dim("Bun + Vercel AI SDK + OpenRouter + Zod")}

${bold("Użycie:")}
  scraper-ai classic              scraping bez AI (bez klucza API)
  scraper-ai scrape               scraping z AI (model z MODEL w .env)
  scraper-ai bench                porównanie modeli → data/bench.md

${bold("Opcje:")}
  --model <id>        model dla scrape, np. google/gemini-2.5-flash-lite
  --models <a,b,…>    lista modeli dla bench
  --runs <n>          powtórzenia na model w bench (1–10)
  --url <adres>       inna strona z books.toscrape.com, np. …/catalogue/page-2.html
  -h, --help          ta pomoc
  -v, --version       wersja

Plik .env z OPENROUTER_API_KEY połóż obok programu albo w bieżącym folderze.
Modele: https://openrouter.ai/models
`;

// Bun sam wczytuje .env z bieżącego folderu. Gdy .exe uruchomiono z innego folderu,
// dociągamy też .env leżący obok pliku .exe (wartości już ustawione mają pierwszeństwo).
function loadEnvNextToExe(): void {
  const compiled = Bun.main.includes("$bunfs") || Bun.main.includes("~BUN");
  if (!compiled) return;
  const envPath = join(dirname(process.execPath), ".env");
  if (!existsSync(envPath) || resolve(envPath) === resolve(".env")) return;

  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(?:export\s+)?([\w.]+)\s*=\s*(.*?)\s*$/);
    if (!m || m[2]!.startsWith("#")) continue;
    const value = m[2]!.replace(/^(['"])(.*)\1$/, "$2");
    Bun.env[m[1]!] ??= value;
  }
}

type Command = "classic" | "scrape" | "bench";

async function run(command: Command, flags: Flags): Promise<void> {
  const config = loadConfig({ ...Bun.env, ...(flags.url ? { TARGET_URL: flags.url } : {}) });
  if (command === "classic") return runClassic(config);
  if (command === "scrape") return runScrape(config, { model: flags.model });

  const runs = flags.runs === undefined ? undefined : Number(flags.runs);
  if (runs !== undefined && !(Number.isInteger(runs) && runs >= 1 && runs <= 10)) {
    throw new Error("--runs musi być liczbą całkowitą od 1 do 10");
  }
  const models = flags.models?.split(",").map((m) => m.trim()).filter(Boolean);
  await runBench(config, { models: models?.length ? models : undefined, runs });
}

// Uruchomienie dwuklikiem (bez argumentów): proste menu, okno nie znika od razu
async function interactive(flags: Flags): Promise<void> {
  console.log(HELP);
  const choices: Record<string, Command> = { "1": "classic", "2": "scrape", "3": "bench" };

  while (true) {
    console.log(`${cyan("1")} classic   ${cyan("2")} scrape   ${cyan("3")} bench   ${cyan("q")} wyjście`);
    const answer = prompt("Wybierz:")?.trim().toLowerCase();
    if (answer === undefined || answer === "q" || answer === "") return;

    const command = choices[answer] ?? (Object.values(choices).find((c) => c === answer) as Command | undefined);
    if (!command) continue;
    console.log();
    await run(command, flags).catch(printError);
    console.log();
  }
}

function printError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`\n${red("Błąd:")} ${message}`);
  process.exitCode = 1;
}

function parseCliArgs() {
  return parseArgs({
    args: Bun.argv.slice(2),
    allowPositionals: true,
    options: {
      model: { type: "string" },
      models: { type: "string" },
      runs: { type: "string" },
      url: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
      version: { type: "boolean", short: "v", default: false },
    },
  });
}
type Flags = ReturnType<typeof parseCliArgs>["values"];

let parsed: ReturnType<typeof parseCliArgs>;
try {
  parsed = parseCliArgs();
} catch (err) {
  console.log(HELP);
  printError(err);
  process.exit(1);
}
const { values: flags, positionals } = parsed;

loadEnvNextToExe();
const command = positionals[0];

if (flags.version) console.log(pkg.version);
else if (flags.help) console.log(HELP);
else if (!command) await interactive(flags);
else if (command === "classic" || command === "scrape" || command === "bench") await run(command, flags).catch(printError);
else {
  console.log(HELP);
  printError(new Error(`Nieznana komenda: ${command}`));
}
