// Product brands and manufacturer records are spelled differently in the catalogue
// (ROCA/Roca, VIVA LUX/Vivalux, Kärcher/KARCHER, Д-р ФРЕШ/Dr Fresh, ТОРЕХ/Topex).
// These keys let a brand find its manufacturer logo despite case, spacing, diacritics or script.

// Cyrillic letters that look identical to Latin ones (ТОРЕХ typed with Cyrillic keys reads as TOPEX).
const LOOKALIKE: Record<string, string> = { а: "a", в: "b", е: "e", к: "k", м: "m", н: "h", о: "o", р: "p", с: "c", т: "t", у: "y", х: "x" };
// Bulgarian transliteration (Д-р ФРЕШ -> dr fresh).
const TRANSLIT: Record<string, string> = { а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya" };

export function brandKeys(name: string | null | undefined): string[] {
  const base = (name ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const keys = [LOOKALIKE, TRANSLIT].map((map) => Array.from(base, (ch) => map[ch] ?? ch).join("").replace(/[^a-z0-9]/g, ""));
  return Array.from(new Set(keys.filter(Boolean)));
}
