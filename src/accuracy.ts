import type { Book } from "./schema";

export type AccuracyScore = {
  accuracy: number; // 0–1: odsetek poprawnych pól względem wzorca
  found: number; // ile książek ze wzorca model znalazł
  expected: number; // ile książek jest we wzorcu
  extra: number; // ile rekordów model dorzucił ponad wzorzec (zmyślone lub zduplikowane)
};

const FIELDS_PER_BOOK = 4; // tytuł, cena, ocena, dostępność

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

// Porównuje wynik modelu z wynikiem klasycznego scrapera.
// Książki dopasowujemy po tytule; nieznaleziona książka = 0 z 4 pól.
export function scoreAccuracy(truth: Book[], extracted: Book[]): AccuracyScore {
  const byTitle = new Map(extracted.map((b) => [normalize(b.title), b]));
  let correctFields = 0;
  let found = 0;

  for (const expected of truth) {
    const got = byTitle.get(normalize(expected.title));
    if (!got) continue;
    found++;
    correctFields++; // tytuł
    if (Math.abs(got.price - expected.price) < 0.005) correctFields++;
    if (got.rating === expected.rating) correctFields++;
    if (got.inStock === expected.inStock) correctFields++;
  }

  return {
    accuracy: truth.length ? correctFields / (truth.length * FIELDS_PER_BOOK) : 0,
    found,
    expected: truth.length,
    extra: Math.max(0, extracted.length - found),
  };
}
