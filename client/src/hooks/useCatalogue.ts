import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { categories as fallbackCategories, products as fallbackProducts, type Product } from "@/lib/storeData";
import { categoryTreeFor, type CategoryNode } from "@/lib/categoryHierarchy";

export type CatalogueIconName = "drill" | "trees" | "house" | "bath" | "lamp" | "panels-top-left" | "waves" | "lock-keyhole" | "paint-roller" | "brick-wall" | "hard-hat";

export type CatalogueCategory = {
  id?: number;
  slug: string;
  label: string;
  description: string;
  image: string;
  icon: CatalogueIconName;
  subcategories: CategoryNode[];
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  metaRobots?: string;
};

export type ManagedProduct = Product & {
  id?: number;
  legacyPublicSlug?: string;
  sku?: string;
  availabilityCode?: "in_stock" | "on_request" | "out_of_stock";
  stockQuantity?: number;
  isActive?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  brandLogo?: string;
};

const staticCategories = fallbackCategories.map((category) => ({ ...category, subcategories: categoryTreeFor(category.slug, category.subcategories) })) as CatalogueCategory[];
const staticProducts = fallbackProducts as ManagedProduct[];

function publicCategories(data: { categories: Array<Omit<CatalogueCategory, "icon" | "subcategories"> & { icon: string; subcategories: CategoryNode[] }> } | undefined) {
  return data?.categories.map((category) => ({ ...category, icon: category.icon as CatalogueIconName, subcategories: categoryTreeFor(category.slug, category.subcategories) })) ?? staticCategories;
}

export type CataloguePageInput = {
  page: number;
  pageSize: number;
  categorySlug?: string;
  path?: string[];
  query?: string;
  brand?: string;
  brands?: string[];
  availability?: Array<"in_stock" | "on_request" | "out_of_stock">;
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price-asc" | "price-desc" | "name-asc" | "name-desc";
};

export function useCatalogue() {
  const { language } = useLanguage();
  const query = trpc.catalogue.metadata.useQuery({ language }, { staleTime: 300_000, retry: 1 });
  return { categories: publicCategories(query.data), products: staticProducts, isLoading: query.isLoading, isDatabaseCatalogue: Boolean(query.data), error: query.error };
}

export function useCataloguePage(input: CataloguePageInput) {
  const { language } = useLanguage();
  const query = trpc.catalogue.page.useQuery({ ...input, language }, { staleTime: 60_000, retry: 1 });
  return { ...query, products: (query.data?.products ?? []) as ManagedProduct[], total: query.data?.total ?? 0, brands: query.data?.brands ?? [], page: query.data?.page ?? input.page, pageSize: query.data?.pageSize ?? input.pageSize };
}

export function useCatalogueProduct(slug: string | undefined) {
  const { language } = useLanguage();
  const query = trpc.catalogue.product.useQuery({ slug: slug ?? "missing-product", language }, { enabled: Boolean(slug), staleTime: 60_000, retry: 1 });
  return { ...query, product: query.data?.product as ManagedProduct | undefined, related: (query.data?.related ?? []) as ManagedProduct[] };
}

export function useCatalogueProducts(slugs: string[]) {
  const { language } = useLanguage();
  const stableSlugs = Array.from(new Set(slugs)).sort();
  const query = trpc.catalogue.productsBySlugs.useQuery({ slugs: stableSlugs.length ? stableSlugs : ["missing-product"], language }, { enabled: stableSlugs.length > 0, staleTime: 60_000, retry: 1 });
  return { ...query, products: (query.data ?? []) as ManagedProduct[] };
}
