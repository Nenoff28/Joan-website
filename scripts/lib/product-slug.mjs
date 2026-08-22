const cyrillicToLatin = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sht", ъ: "a", ь: "y", ю: "yu", я: "ya",
};

export function toLatinSlug(value) {
  return Array.from(String(value ?? "").trim().toLocaleLowerCase("bg-BG").normalize("NFD"))
    .map((character) => cyrillicToLatin[character] ?? character)
    .join("")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 150)
    .replace(/-+$/g, "");
}

export function preferredProductSlug({ legacySeoKeywordBg, name, legacyProductId, id }) {
  return toLatinSlug(legacySeoKeywordBg) || toLatinSlug(name) || `product-${legacyProductId ?? id}`;
}

export function uniqueProductSlug(base, discriminator, usedSlugs) {
  let candidate = base;
  if (usedSlugs.has(candidate)) candidate = `${base.slice(0, 145).replace(/-+$/g, "")}-${discriminator}`;
  let sequence = 2;
  while (usedSlugs.has(candidate)) candidate = `${base.slice(0, 140).replace(/-+$/g, "")}-${discriminator}-${sequence++}`;
  usedSlugs.add(candidate);
  return candidate;
}

export function legacyProductSlug(name, legacyProductId) {
  const normalized = toLatinSlug(name) || "record";
  return `legacy-${legacyProductId}-${normalized}`.slice(0, 160).replace(/-+$/g, "");
}
