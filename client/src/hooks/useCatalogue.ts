import { trpc } from "@/lib/trpc";
import { categories as fallbackCategories, products as fallbackProducts, type Product } from "@/lib/storeData";

export type CatalogueIconName = "drill" | "trees" | "house" | "bath" | "lamp" | "panels-top-left" | "waves" | "lock-keyhole" | "paint-roller" | "brick-wall" | "hard-hat";

export type CatalogueCategory = {
  id?: number;
  slug: string;
  label: string;
  description: string;
  image: string;
  icon: CatalogueIconName;
  subcategories: string[];
};

export type ManagedProduct = Product & {
  id?: number;
  sku?: string;
  availabilityCode?: "in_stock" | "on_request" | "out_of_stock";
  stockQuantity?: number;
  isActive?: boolean;
};

const staticCategories = fallbackCategories.map((category) => ({ ...category, subcategories: [...category.subcategories] })) as CatalogueCategory[];
const staticProducts = fallbackProducts as ManagedProduct[];

export function useCatalogue() {
  const query = trpc.catalogue.list.useQuery(undefined, { staleTime: 60_000, retry: 1 });
  const categories: CatalogueCategory[] = query.data?.categories.map((category) => ({
    ...category,
    icon: category.icon as CatalogueIconName,
  })) ?? staticCategories;
  const products: ManagedProduct[] = query.data?.products ?? staticProducts;
  return { categories, products, isLoading: query.isLoading, isDatabaseCatalogue: Boolean(query.data), error: query.error };
}
