# scraper-ai

Projekt demo do prezentacji „Wykrywanie i pobieranie danych ze stron internetowych za pomocą AI”.

Scraper w **TypeScript** uruchamiany w **Bun**. Z modelami AI łączy się przez **Vercel AI SDK** (pakiet `ai`) i bramkę **OpenRouter**, a format danych pilnuje **Zod**. Stroną testową jest [books.toscrape.com](https://books.toscrape.com/), stworzona do nauki scrapingu.

```
robots.txt → fetch (Bun) → Cheerio czyści HTML (~12,8k → ~2,2k tokenów)
           → model AI przez OpenRouter (AI SDK, Output.object)
           → walidacja schematem Zod → JSON + porównanie z wzorcem
```

## Szybki start

```bash
bun install
cp .env.example .env     # wpisz OPENROUTER_API_KEY
bun run classic          # bez AI i bez klucza
bun run scrape           # z AI (domyślnie Claude Haiku 5.5)
bun run bench            # porównanie modeli → data/bench.md
```

Opcje (po `bun run src/cli.ts <komenda>` albo `scraper-ai.exe <komenda>`):

| Opcja | Co robi |
|---|---|
| `--model <id>` | inny model dla `scrape`, np. `google/gemini-2.5-flash-lite` |
| `--models <a,b>` | lista modeli dla `bench` |
| `--runs <n>` | powtórzenia na model w `bench` (1–10) |
| `--url <adres>` | inna strona z books.toscrape.com, np. `https://books.toscrape.com/catalogue/page-2.html` |

## Gotowy program (bez instalowania czegokolwiek)

1. Wejdź w [Releases](../../releases) i pobierz paczkę dla swojego systemu:
   `scraper-ai-windows-x64.zip`, `scraper-ai-macos-arm64.zip` (M1–M4), `scraper-ai-macos-x64.zip` (Intel) albo `scraper-ai-linux-x64.zip`.
2. Rozpakuj. W folderze jest program i plik `.env.example`.
3. Zmień nazwę `.env.example` na `.env` i wpisz w nim swój klucz: `OPENROUTER_API_KEY=sk-or-...` ([openrouter.ai/keys](https://openrouter.ai/keys)).
4. Uruchom program (na Windows dwuklik w `scraper-ai.exe`).

macOS przy pierwszym uruchomieniu blokuje pliki z internetu. W Terminalu, w rozpakowanym folderze:

```bash
xattr -d com.apple.quarantine scraper-ai-mac && ./scraper-ai-mac
```

Paczki buduje GitHub Actions ([.github/workflows/build.yml](.github/workflows/build.yml)) po wypchnięciu tagu, np. `git tag v2.0.0 && git push origin v2.0.0`. Workflow nie zna żadnego klucza API.

## Budowanie lokalnie

```bash
bun run build:win        # → dist/scraper-ai.exe (ok. 87 MB, zawiera runtime Bun)
bun run build:mac        # → dist/scraper-ai-mac (Apple Silicon)
bun run build:mac-intel  # → dist/scraper-ai-mac-intel
bun run build:linux      # → dist/scraper-ai-linux
```

Osoba, która dostanie plik, nie musi instalować Bun ani Node.js:

```cmd
scraper-ai.exe classic
scraper-ai.exe scrape --model openai/gpt-5.6-luna
scraper-ai.exe bench --runs 3
```

- Uruchomienie dwuklikiem otwiera menu (1 classic · 2 scrape · 3 bench · q wyjście).
- **Klucza API nie ma w .exe.** Każdy kładzie obok pliku własny `.env` z `OPENROUTER_API_KEY`.
- Windows SmartScreen może ostrzec przed niepodpisanym programem: „Więcej informacji” → „Uruchom mimo to”.
- Wyniki (`data/books.json`, `data/bench.md`) trafiają do folderu, z którego uruchomiono program.

## Pliki

| Plik | Co robi |
|---|---|
| `src/classic.ts` | Klasyczny scraping selektorami CSS (Cheerio), wynik to też wzorzec prawdy |
| `src/clean.ts` | Czyszczenie HTML przed wysłaniem do modelu (mniej tokenów = niższy koszt) |
| `src/schema.ts` | Schemat Zod: format dla modelu, walidacja odpowiedzi, typy TS |
| `src/extract.ts` | Wywołanie modelu: AI SDK + OpenRouter, `Output.object`, tokeny i koszt |
| `src/bench.ts` | Porównanie modeli: czas, tokeny, koszt 1 i 1000 stron, trafność, błędy |
| `src/accuracy.ts` | Trafność względem wzorca z Cheerio |
| `src/fetchPage.ts` | Pobieranie strony i sprawdzanie robots.txt |
| `src/scrape.ts` | Pełny przepływ dla jednego modelu |
| `src/config.ts` | Ustawienia z `.env`, sprawdzane przez Zod |
| `src/cli.ts` | Punkt wejścia (także dla .exe): komendy, flagi, menu |
| `test/` | Testy bez klucza API i internetu (atrapa modelu z `ai/test`, zapisana kopia strony): `bun test` |

## Sprawdzenie

```bash
bun run typecheck
bun test
```

## Residential proxy

Projekt celowo **nie korzysta** z proxy, bo books.toscrape.com nie blokuje scraperów. Komercyjne narzędzia (Apify, Bright Data, Browserbase) omijają blokady adresów IP centrów danych, puszczając ruch przez adresy domowych łączy.
