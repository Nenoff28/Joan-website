// Prices travel as "2.71€" (parsed elsewhere for totals and structured data); only the shown text uses the Bulgarian "2,71 €".
export function displayPrice(price: string | null | undefined) {
  if (!price) return price ?? undefined;
  const match = price.match(/^(\d+)\.(\d{2})\s*€$/);
  return match ? `${match[1]},${match[2]} €` : price;
}
