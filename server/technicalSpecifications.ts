export type TechnicalSpecification = { label: string; value: string };

const technicalSectionPattern = /(?:технически\s+данни|техническа\s+информация|допълнителна\s+информация|характеристики|спецификации?)\s*:/i;
const bulletPattern = /^\s*(?:[•▪●◦\-*–—]+\s*)?([^:\n]{2,72}):\s*(.+?)\s*$/;
const ignoredLabels = new Set(["описание", "допълнителна информация", "технически данни", "техническа информация", "характеристики", "спецификация", "спецификации"]);

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\r/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normaliseInlinePairs(value: string) {
  return value.replace(/([^\n])(?=(?:[А-ЯA-Z][А-Яа-яA-Za-z0-9()/%.,+~\- ]{2,65}):\s*)/g, "$1\n");
}

function collectPairs(value: string) {
  return normaliseInlinePairs(value)
    .split(/\n+/)
    .flatMap((line) => {
      const match = line.match(bulletPattern);
      if (!match) return [];
      const label = match[1].replace(/\s+/g, " ").trim();
      const specificationValue = match[2].replace(/\s+/g, " ").trim();
      if (!label || !specificationValue || ignoredLabels.has(label.toLocaleLowerCase("bg-BG"))) return [];
      return [{ label, value: specificationValue }];
    });
}

function inferUnlabelledTechnicalValue(sourceValue: string): TechnicalSpecification | null {
  const value = sourceValue.replace(/^\s*(?:[•▪●◦\-*–—]+\s*)/, "").replace(/\s+/g, " ").trim();
  if (!value || value.length > 90 || /[.!?]$/.test(value)) return null;
  if (/^(?:туба|кофа|флакон|бутилка|спрей|саше|опаковка)/i.test(value) && /\d/.test(value)) return { label: "Опаковка", value };
  if (/\d+(?:[.,]\d+)?\s*(?:мл|ml|л|l)/i.test(value)) return { label: "Обем", value };
  if (/\d+(?:[.,]\d+)?\s*(?:кг|kg|гр|g)/i.test(value)) return { label: "Тегло", value };
  if (/\d+(?:[.,]\d+)?\s*(?:w|kw|вт|v|hz|db)/i.test(value)) return { label: "Характеристика", value };
  if (/\d+(?:[.,]\d+)?\s*(?:мм|mm|см|cm|м|x|х|×)/i.test(value)) return { label: "Размер", value };
  return null;
}

function collectTechnicalContent(value: string, allowSectionValue = false) {
  const specifications: TechnicalSpecification[] = [];
  for (const line of normaliseInlinePairs(value).split(/\n+/)) {
    const pairs = collectPairs(line);
    if (pairs.length) {
      addUnique(specifications, pairs);
      continue;
    }
    const inferred = inferUnlabelledTechnicalValue(line);
    if (inferred) addUnique(specifications, [inferred]);
    else if (allowSectionValue && line.trim()) addUnique(specifications, [{ label: "Допълнителна информация", value: line.trim() }]);
  }
  return specifications;
}

function addUnique(target: TechnicalSpecification[], candidates: TechnicalSpecification[]) {
  for (const candidate of candidates) {
    const key = `${candidate.label.toLocaleLowerCase("bg-BG")}\u0000${candidate.value.toLocaleLowerCase("bg-BG")}`;
    const duplicate = target.some((item) => `${item.label.toLocaleLowerCase("bg-BG")}\u0000${item.value.toLocaleLowerCase("bg-BG")}` === key);
    if (!duplicate) target.push(candidate);
  }
}

function featurePairs(features: string[]) {
  return features.flatMap((feature) => {
    const match = feature.match(/^\s*([^:]{2,72}):\s*(.+?)\s*$/);
    return match ? [{ label: match[1].replace(/\s+/g, " ").trim(), value: match[2].replace(/\s+/g, " ").trim() }] : [];
  });
}

/**
 * Separates explicit key:value technical data from product copy. It is intentionally
 * conservative: prose is preserved unless a labelled pair or named technical block
 * is present, and the database source description is never changed.
 */
export function splitProductDescription(sourceDescription: string, features: string[]) {
  const description = plainText(sourceDescription);
  const technicalSpecs: TechnicalSpecification[] = [];
  const sectionMatch = description.match(technicalSectionPattern);
  let prose = description;

  if (sectionMatch?.index != null) {
    const start = sectionMatch.index;
    const dataStart = start + sectionMatch[0].length;
    const before = description.slice(0, start).trim();
    const technicalPart = description.slice(dataStart).trim();
    const isAdditionalInformation = /^допълнителна\s+информация/i.test(sectionMatch[0]);
    addUnique(technicalSpecs, collectTechnicalContent(technicalPart, isAdditionalInformation));
    prose = before;
  }

  const proseLines = prose.split(/\n+/);
  const remainingLines: string[] = [];
  for (const line of proseLines) {
    const pairs = collectPairs(line);
    if (pairs.length === 1 && /^\s*(?:[•▪●◦\-*–—]+\s*)/.test(line)) {
      addUnique(technicalSpecs, pairs);
    } else if (/^\s*(?:[•▪●◦\-*–—]+\s*)/.test(line)) {
      const inferred = inferUnlabelledTechnicalValue(line);
      if (inferred) addUnique(technicalSpecs, [inferred]);
      else {
        const value = line.replace(/^\s*(?:[•▪●◦\-*–—]+\s*)/, "").replace(/\s+/g, " ").trim();
        if (value && value.length <= 140) addUnique(technicalSpecs, [{ label: "Характеристика", value }]);
        else remainingLines.push(line);
      }
    } else {
      remainingLines.push(line);
    }
  }
  addUnique(technicalSpecs, featurePairs(features));

  const remainingDescription = remainingLines.join("\n\n").replace(/^\s*описание\s*:\s*/i, "").trim();
  return { description: remainingDescription || (technicalSpecs.length ? "" : description), technicalSpecs };
}
