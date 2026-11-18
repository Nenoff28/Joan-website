export type QuickOrderLine = { code: string; quantity: number };

// Accepts one code per line: "12829", "12829 x10", "12829 х 10" (Cyrillic х), "12829*10", "12829 10" or "12829;10".
// Repeated codes are merged so the cart gets one line per product.
export function parseQuickOrder(text: string): QuickOrderLine[] {
  const merged = new Map<string, QuickOrderLine>();
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const match = line.match(/^(\S+?)\s*(?:[xхX×*;,]|\s)\s*(\d{1,4})$/) ?? line.match(/^(\S+)$/);
    if (!match) continue;
    const code = match[1];
    const quantity = Math.min(9999, Math.max(1, Number(match[2] ?? 1)));
    const key = code.toLowerCase();
    const existing = merged.get(key);
    merged.set(key, { code: existing?.code ?? code, quantity: (existing?.quantity ?? 0) + quantity });
  }
  return Array.from(merged.values());
}
