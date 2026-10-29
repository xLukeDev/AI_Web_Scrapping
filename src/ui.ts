import type { Book } from "./schema";

// Drobne pomocniki do ładnego wypisywania wyników w terminalu

const useColor = process.stdout.isTTY && !Bun.env.NO_COLOR;
const paint = (code: number) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);

export const bold = paint(1);
export const dim = paint(2);
export const red = paint(31);
export const green = paint(32);
export const yellow = paint(33);
export const cyan = paint(36);

export const usd = (v: number | undefined, digits = 5) => (v === undefined ? "–" : `$${v.toFixed(digits)}`);
export const pct = (v: number) => `${(v * 100).toFixed(0)}%`;
export const int = (v: number) => Math.round(v).toLocaleString("pl-PL");

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export type Column<T> = { header: string; value: (row: T) => string | number; align?: "left" | "right"; max?: number };

export function printTable<T>(rows: T[], columns: Column<T>[]): void {
  const cells = rows.map((row) => columns.map((c) => truncate(String(c.value(row)), c.max ?? 60)));
  const widths = columns.map((c, i) => Math.max(c.header.length, ...cells.map((r) => r[i]!.length)));
  const pad = (s: string, i: number) => (columns[i]!.align === "right" ? s.padStart(widths[i]!) : s.padEnd(widths[i]!));
  const line = (parts: string[]) => `  ${parts.join("  ")}`;

  console.log(bold(line(columns.map((c, i) => pad(c.header, i)))));
  console.log(dim(line(widths.map((w) => "─".repeat(w)))));
  for (const r of cells) console.log(line(r.map(pad)));
}

export function printBooks(books: Book[]): void {
  printTable(books.map((b, i) => ({ ...b, n: i + 1 })), [
    { header: "#", value: (b) => b.n, align: "right" },
    { header: "Tytuł", value: (b) => b.title, max: 50 },
    { header: "Cena", value: (b) => `${b.price.toFixed(2)} ${b.currency}`, align: "right" },
    { header: "Ocena", value: (b) => "★".repeat(Math.max(0, Math.min(5, b.rating))).padEnd(5, "☆") },
    { header: "Dostępna", value: (b) => (b.inStock ? "tak" : "nie") },
  ]);
}

export function toMarkdownTable<T>(rows: T[], columns: Column<T>[]): string {
  const row = (parts: string[]) => `| ${parts.join(" | ")} |`;
  return [
    row(columns.map((c) => c.header)),
    row(columns.map((c) => (c.align === "right" ? "---:" : "---"))),
    ...rows.map((r) => row(columns.map((c) => String(c.value(r))))),
  ].join("\n");
}
