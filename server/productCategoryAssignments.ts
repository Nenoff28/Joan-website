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
  parentId?: number | null;
  name: string;
  sortOrder: number;
  slug?: string | null;
  isActive?: boolean;
  /** Optional for compatibility with legacy helper fixtures created before category archiving. */
  isArchived?: boolean;
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

function rowIsSelectable(row: ProductCategoryTreeRow) {
  // Imported taxonomy rows deliberately keep their historical behaviour, including
  // imported rows whose source isActive flag is false. Native children, unlike those
  // rows, are storefront content and must be active before they can be selected.
  return row.isArchived !== true && (row.legacyCategoryId != null || row.isActive !== false);
}

function sortRows(rows: ProductCategoryTreeRow[]) {
  return rows.sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg") || left.id - right.id);
}

function directChildren(
  rows: ProductCategoryTreeRow[],
  parent: ProductCategoryTreeRow | null,
  rootInternalId: number | undefined,
  rootLegacyIds: readonly number[],
) {
  return sortRows(rows.filter((row) => {
    if (row.legacyCategoryId == null && row.parentId != null) {
      if (parent) return row.parentId === parent.id;
      return rootInternalId != null && row.parentId === rootInternalId;
    }
    if (row.legacyCategoryId != null && parent?.legacyCategoryId != null) {
      return row.legacyParentCategoryId === parent.legacyCategoryId;
    }
    if (row.legacyCategoryId != null && !parent) {
      return row.legacyParentCategoryId != null && rootLegacyIds.includes(row.legacyParentCategoryId);
    }
    return false;
  }));
}

/** Builds root-only options and supports native branches attached to either roots or imported rows. */
export function buildProductCategoryOptions(
  rootRows: ProductCategoryTreeRow[],
  taxonomyRows: ProductCategoryTreeRow[],
  rootMap: LegacyRootMap = legacyCategoryRootsByPublicSlug,
  rootInternalId?: number,
): ProductCategoryOption[] {
  const buildChildren = (parent: ProductCategoryTreeRow | null, root: ProductCategoryTreeRow, depth: number): ProductCategoryOption[] => {
    if (depth >= 4) return [];
    const legacyRootIds = rootMap[root.slug ?? ""] ?? [];
    return directChildren(taxonomyRows, parent, root.id, legacyRootIds)
      .filter(rowIsSelectable)
      .map((row) => {
        const children = buildChildren(row, root, depth + 1);
        return { id: row.id, label: row.name, ...(children.length ? { children } : {}) };
      });
  };

  return [...rootRows]
    .filter((row) => row.isArchived !== true && row.isActive === true && row.legacyCategoryId == null && (row.parentId == null || row.parentId === undefined))
    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name, "bg") || left.id - right.id)
    .map((root) => {
      const children = buildChildren(null, root, 0);
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
  rootInternalId?: number,
): ProductCategoryTreeRow[] {
  const selected = selectedInternalIds ?? [];
  if (selected.length > 4) throw new Error("Изберете най-много четири нива на подкатегории.");
  if (new Set(selected).size !== selected.length) throw new Error("Подкатегориите не могат да се повтарят.");
  if (!selected.length) return [];

  const byId = new Map(taxonomyRows.map((row) => [row.id, row]));
  let parent: ProductCategoryTreeRow | null = null;
  const path: ProductCategoryTreeRow[] = [];
  for (const internalId of selected) {
    const row = byId.get(internalId);
    if (!row || !rowIsSelectable(row)) {
      throw new Error("Избраните подкатегории трябва да са активни и да образуват непрекъснат път към избраната главна категория.");
    }
    const isChild = parent
      ? (row.parentId === parent.id || (parent.legacyCategoryId != null && row.legacyParentCategoryId === parent.legacyCategoryId))
      : ((row.parentId != null && rootInternalId != null && row.parentId === rootInternalId) || (row.legacyParentCategoryId != null && rootLegacyIds.includes(row.legacyParentCategoryId)));
    if (!isChild) {
      throw new Error("Избраните подкатегории трябва да образуват непрекъснат път към избраната главна категория.");
    }
    path.push(row);
    parent = row;
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

function ancestorsFor(
  end: ProductCategoryTreeRow,
  byId: Map<number, ProductCategoryTreeRow>,
  selected: Set<number>,
  rootLegacyIds: readonly number[],
  rootInternalId?: number,
) {
  const reverse: ProductCategoryTreeRow[] = [];
  const seen = new Set<number>();
  let current: ProductCategoryTreeRow | undefined = end;
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    reverse.push(current);
    if (current.parentId != null) {
      if (rootInternalId != null && current.parentId === rootInternalId) return reverse.reverse();
      const parent = byId.get(current.parentId);
      if (!parent || !selected.has(parent.id)) return [];
      current = parent;
      continue;
    }
    if (current.legacyParentCategoryId != null && rootLegacyIds.includes(current.legacyParentCategoryId)) return reverse.reverse();
    if (current.legacyParentCategoryId == null || current.legacyCategoryId == null) return [];
    const parent = Array.from(byId.values()).find((candidate) => candidate.legacyCategoryId === current!.legacyParentCategoryId && selected.has(candidate.id));
    if (!parent) return [];
    current = parent;
  }
  return [];
}

/** Selects the longest valid linked branch, with stable position/id tie-breaking. */
export function canonicalSelectedSubcategoryPath(
  taxonomyRows: ProductCategoryTreeRow[],
  rootLegacyIds: readonly number[],
  links: readonly { categoryId: number; position?: number | null }[],
  rootInternalId?: number,
): ProductCategoryTreeRow[] {
  const byId = new Map(taxonomyRows.map((row) => [row.id, row]));
  const selected = new Set(links.map((link) => link.categoryId));
  const positions = new Map<number, number>();
  for (const link of links) {
    const position = link.position ?? Number.MAX_SAFE_INTEGER;
    if (!positions.has(link.categoryId) || position < positions.get(link.categoryId)!) positions.set(link.categoryId, position);
  }
  const paths = Array.from(selected).flatMap((internalId) => {
    const end = byId.get(internalId);
    if (!end || !rowIsSelectable(end)) return [];
    const path = ancestorsFor(end, byId, selected, rootLegacyIds, rootInternalId);
    return path.length && path.length <= 4 ? [path] : [];
  });
  paths.sort((left, right) => comparePaths(left, right, positions));
  return paths[0] ?? [];
}

export function categoryPathNodes(path: readonly ProductCategoryTreeRow[]): ProductCategoryPathNode[] {
  return path.map((row) => ({ id: row.id, label: row.name }));
}
