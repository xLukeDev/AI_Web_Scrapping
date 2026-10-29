import { z } from "zod";

// Jeden schemat Zod robi trzy rzeczy:
// 1) mówi modelowi AI, jakie pola ma zwrócić (AI SDK zamienia go na JSON Schema),
// 2) sprawdza odpowiedź modelu – zły format od razu kończy się błędem,
// 3) daje typy TypeScript dla reszty kodu (z.infer).

export const BookSchema = z.object({
  title: z.string().describe("Pełny tytuł książki. Jeśli link ma atrybut title, użyj go – tekst linku bywa ucięty."),
  price: z.number().describe("Cena jako liczba, bez symbolu waluty, np. 51.77"),
  currency: z.string().describe("Kod waluty ISO 4217, np. GBP dla £"),
  rating: z.int().describe("Ocena w gwiazdkach od 1 do 5 (klasa CSS, np. 'star-rating Three' = 3)"),
  inStock: z.boolean().describe("true, jeśli książka jest dostępna (In stock)"),
});

export const BooksSchema = z.object({
  books: z.array(BookSchema).describe("Wszystkie książki z fragmentu strony, w kolejności występowania"),
});

export type Book = z.infer<typeof BookSchema>;
