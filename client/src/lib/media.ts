export function publicMediaUrl(value: string | null | undefined): string {
  if (!value || !value.startsWith("/manus-storage/")) return value ?? "";

  const key = value.slice("/manus-storage/".length);
  const localKey = key.startsWith("catalogue/") || key.startsWith("brochures/")
    ? key.replace(/\.(?:jpe?g|png|mpo)$/i, ".webp")
    : key;

  return `/media/${localKey}`;
}
