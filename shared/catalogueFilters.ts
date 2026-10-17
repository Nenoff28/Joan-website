/** URL-derived catalogue filters work identically in the browser and SSR. */
export function isPromotionFilter(search: string): boolean {
  return new URLSearchParams(search).get("promotion") === "1";
}

export function withPromotionFilter(
  path: string,
  search: string,
  enabled: boolean
): string {
  const params = new URLSearchParams(search);
  if (enabled) params.set("promotion", "1");
  else params.delete("promotion");
  const query = params.toString();
  return `${path}${query ? `?${query}` : ""}`;
}
