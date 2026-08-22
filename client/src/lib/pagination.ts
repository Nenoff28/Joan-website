export type PaginationItem = number | "ellipsis";

export function paginationItems(totalPages: number, currentPage: number): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages));
  const current = Math.max(1, Math.min(Math.floor(currentPage), total));
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const visible = new Set([1, 2, current - 1, current, current + 1, total - 1, total].filter((page) => page >= 1 && page <= total));
  const pages = Array.from(visible).sort((left, right) => left - right);
  const items: PaginationItem[] = [];
  for (const page of pages) {
    const previous = items.at(-1);
    if (typeof previous === "number" && page - previous > 1) items.push("ellipsis");
    items.push(page);
  }
  return items;
}
