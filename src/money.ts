/** Money helpers. Everything in the database is an integer number of cents. */

/** "1,234.56" / "$1234.56" / "1234" -> 123456. Junk and blanks become 0. */
export function parseMoneyToCents(input: unknown): number {
  if (typeof input === "number") return Math.round(input * 100);
  const cleaned = String(input ?? "").replace(/[$,\s]/g, "");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** 123456 -> "1,234.56". No currency symbol; templates add it. */
export function formatCents(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100).toLocaleString("en-US");
  const rest = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}${dollars}.${rest}`;
}

/** Per-mile figures read better as "1.87" than "187c". */
export function formatCentsPerMile(cents: number): string {
  return formatCents(cents);
}

export function parseNumber(input: unknown, fallback = 0): number {
  const cleaned = String(input ?? "").replace(/[,\s]/g, "");
  if (cleaned === "") return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

export function parseInt10(input: unknown, fallback = 0): number {
  return Math.round(parseNumber(input, fallback));
}
