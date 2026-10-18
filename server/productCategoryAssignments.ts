export type ProductCategoryOption = {
  id: number;
  label: string;
  slug?: string;
  children?: ProductCategoryOption[];
};

export type ProductCategoryTreeRow = {
  id: number;
  legacyCategoryId: number | null;
  legacyParentCategoryId: number | null;
  name: string;
  sortOrder: number;
  slug?: string | null;
  isActive?: boolean;
};

export type ProductCategoryPathNode = { id: number; label: string };

type LegacyRootMap = Record<string, number[]>;

/** The imported taxonomy roots represented by each public, active catalogue root. */
export const legacyCategoryRootsByPublicSlug: LegacyRootMap = {
  instrumenti: [91],
  gradina: [93],
  banya: [95],
  "podovi-i-stenni-pokritiya": [90],
  "v-i-k": [97],
  osvetlenie: [163],
  "boi-lakove-mazilki": [92],
  "vrati-obkov-krepezhi": [199],
  "za-doma": [204],
  stroitelstvo: [178, 85],
  "rabotno-obleklo": [61],
};

function sortedChildren(rows: ProductCategoryTreeRow[], parentLegacyIds: readonly number[]) {
  return rows
    .filter((row) => row.legacyCategoryId != null && row.legacyParentCategoryId != null && parentLegacyIds.includes(row.legacyParentCategoryId))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg") || left.id - right.id);
}

/** Builds root-only options; inactive imported taxonomy rows are valid subcategory options by design. */
export function buildProductCategoryOptions(
  rootRows: ProductCategoryTreeRow[],
  taxonomyRows: ProductCategoryTreeRow[],
  rootMap: LegacyRootMap = legacyCategoryRootsByPublicSlug,
): ProductCategoryOption[] {
  const buildChildren = (parentLegacyIds: readonly number[], depth: number): ProductCategoryOption[] => {
    if (depth >= 4) return [];
    return sortedChildren(taxonomyRows, parentLegacyIds).map((row) => {
      const legacyId = row.legacyCategoryId!;
      const children = buildChildren([legacyId], depth + 1);
      return { id: row.id, label: row.name, ...(children.length ? { children } : {}) };
    });
  };

  return [...rootRows]
    .filter((row) => row.isActive === true && row.legacyCategoryId == null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg") || left.id - right.id)
    .map((root) => {
      const children = buildChildren(rootMap[root.slug ?? ""] ?? [], 0);
      return { id: root.id, label: root.name, ...(root.slug ? { slug: root.slug } : {}), ...(children.length ? { children } : {}) };
    });
}

/**
 * Validates an ordered selection. The public root is active separately; imported
 * taxonomy rows intentionally remain inactive and must still be accepted here.
 */
export function validateSelectedSubcategoryPath(
  taxonomyRows: ProductCategoryTreeRow[],
  rootLegacyIds: readonly number[],
  selectedInternalIds: readonly number[] | undefined,
): ProductCategoryTreeRow[] {
  const selected = selectedInternalIds ?? [];
  if (selected.length > 4) throw new Error("Изберете най-много четири нива на подкатегории.");
  if (new Set(selected).size !== selected.length) throw new Error("Подкатегориите не могат да се повтарят.");
  if (!selected.length) return [];

  const byId = new Map(taxonomyRows.map((row) => [row.id, row]));
  let parentLegacyIds = new Set(rootLegacyIds);
  const path: ProductCategoryTreeRow[] = [];
  for (const internalId of selected) {
    const row = byId.get(internalId);
    if (!row || row.legacyCategoryId == null || row.legacyParentCategoryId == null || !parentLegacyIds.has(row.legacyParentCategoryId)) {
      throw new Error("Избраните подкатегории трябва да образуват непрекъснат път към избраната главна категория.");
    }
    path.push(row);
    parentLegacyIds = new Set([row.legacyCategoryId]);
  }
  return path;
}

function comparePaths(left: ProductCategoryTreeRow[], right: ProductCategoryTreeRow[], positions: Map<number, number>) {
  if (left.length !== right.length) return right.length - left.length;
  for (let index = 0; index < left.length; index += 1) {
    const positionDifference = (positions.get(left[index].id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right[index].id) ?? Number.MAX_SAFE_INTEGER);
    if (positionDifference) return positionDifference;
    if (left[index].id !== right[index].id) return left[index].id - right[index].id;
  }
  return 0;
}

/** Selects the longest valid linked branch, with stable position/id tie-breaking. */
export function canonicalSelectedSubcategoryPath(
  taxonomyRows: ProductCategoryTreeRow[],
  rootLegacyIds: readonly number[],
  links: readonly { categoryId: number; position?: number | null }[],
): ProductCategoryTreeRow[] {
  const byId = new Map(taxonomyRows.map((row) => [row.id, row]));
  const selected = new Set(links.map((link) => link.categoryId));
  const positions = new Map<number, number>();
  for (const link of links) {
    const position = link.position ?? Number.MAX_SAFE_INTEGER;
    if (!positions.has(link.categoryId) || position < positions.get(link.categoryId)!) positions.set(link.categoryId, position);
  }
  const rootIds = new Set(rootLegacyIds);
  const paths: ProductCategoryTreeRow[][] = [];

  for (const internalId of Array.from(selected)) {
    const end = byId.get(internalId);
    if (!end || end.legacyCategoryId == null || rootIds.has(end.legacyCategoryId)) continue;
    const reverse: ProductCategoryTreeRow[] = [];
    const seen = new Set<number>();
    let current: ProductCategoryTreeRow | undefined = end;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      if (current.legacyCategoryId == null || current.legacyParentCategoryId == null) {
        current = undefined;
        break;
      }
      reverse.push(current);
      if (rootIds.has(current.legacyParentCategoryId)) break;
      current = Array.from(byId.values()).find((row) => row.legacyCategoryId === current!.legacyParentCategoryId && selected.has(row.id));
    }
    if (reverse.length && rootIds.has(reverse[reverse.length - 1].legacyParentCategoryId!)) paths.push(reverse.reverse());
  }

  paths.sort((left, right) => comparePaths(left, right, positions));
  return paths[0] ?? [];
}

export function categoryPathNodes(path: readonly ProductCategoryTreeRow[]): ProductCategoryPathNode[] {
  return path.map((row) => ({ id: row.id, label: row.name }));
}
