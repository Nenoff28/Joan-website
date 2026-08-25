import type { QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { trpc } from "@/lib/trpc";

export type HeadMeta = { title: string; description: string; canonicalPath?: string; ogImage?: string; ogImageAlt?: string; ogType?: "website" | "product"; noindex?: boolean; notFound?: boolean };
export type CataloguePageInput = { page: number; pageSize: number; categorySlug?: string; path?: string[]; query?: string; brand?: string; availability?: Array<"in_stock" | "on_request" | "out_of_stock">; minPrice?: number; maxPrice?: number; sort?: "relevance" | "price-asc" | "price-desc" | "name-asc" | "name-desc" };
export type SsrPrefetch = { metadata: () => Promise<any>; page: (input: CataloguePageInput) => Promise<any>; bestSellers: () => Promise<any>; product: (input: { slug: string }) => Promise<any>; brochure: () => Promise<any> };

const SITE = "ЖОАН";
const DEFAULT_DESCRIPTION = "Онлайн каталог на ЖОАН за инструменти, дом, градина, баня и строителни материали.";
const HOME_TITLE = `Строителни материали и инструменти | ${SITE}`;
const HOME_DESCRIPTION = "ЖОАН в Силистра: строителни материали, инструменти, продукти за дома и градината. Открийте всичко за ремонта на едно място.";
const seed = (queryClient: QueryClient, key: unknown, data: unknown) => queryClient.setQueryData(key as any, data);
const cleanPath = (url: string) => { try { return decodeURI(url.split("?")[0]).replace(/\/+$/, "") || "/"; } catch { return "/"; } };

export async function prefetchForPath(url: string, queryClient: QueryClient, prefetch: SsrPrefetch): Promise<HeadMeta> {
  const path = cleanPath(url);
  const metadataPromise = prefetch.metadata();
  const headerSearch = { page: 1, pageSize: 4, query: undefined, sort: "relevance" as const };
  const headerSearchPromise = prefetch.page(headerSearch);
  if (path === "/") {
    const homeInput = { page: 1, pageSize: 12, sort: "relevance" as const };
    const [metadata, headerSearchData, homeData, bestSellerData, brochureData] = await Promise.all([metadataPromise, headerSearchPromise, prefetch.page(homeInput), prefetch.bestSellers(), prefetch.brochure()]);
    seed(queryClient, getQueryKey(trpc.catalogue.metadata, undefined, "query"), metadata);
    seed(queryClient, getQueryKey(trpc.catalogue.page, headerSearch, "query"), headerSearchData);
    seed(queryClient, getQueryKey(trpc.catalogue.page, homeInput, "query"), homeData);
    seed(queryClient, getQueryKey(trpc.catalogue.bestSellers, undefined, "query"), bestSellerData);
    seed(queryClient, getQueryKey(trpc.catalogue.brochure, undefined, "query"), brochureData);
    return { title: HOME_TITLE, description: HOME_DESCRIPTION, canonicalPath: "/" };
  }
  const metadata = await metadataPromise;
  await seed(queryClient, getQueryKey(trpc.catalogue.metadata, undefined, "query"), metadata);
  await seed(queryClient, getQueryKey(trpc.catalogue.page, headerSearch, "query"), await headerSearchPromise);
  if (path === "/products") {
    const input = { page: 1, pageSize: 48, sort: "relevance" as const };
    await seed(queryClient, getQueryKey(trpc.catalogue.page, input, "query"), await prefetch.page(input));
    return { title: `Всички продукти | ${SITE}`, description: DEFAULT_DESCRIPTION, canonicalPath: "/products" };
  }
  const categoryMatch = path.match(/^\/category\/([a-z0-9-]+)$/);
  if (categoryMatch) {
    const category = metadata.categories.find((item: any) => item.slug === categoryMatch[1]);
    if (!category) return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
    const params = new URLSearchParams(url.slice(url.indexOf("?") + 1));
    const tokens = params.get("path")?.split("~").filter(Boolean);
    const input = { page: 1, pageSize: 48, categorySlug: category.slug, path: tokens?.length ? tokens : undefined, sort: "relevance" as const };
    await seed(queryClient, getQueryKey(trpc.catalogue.page, input, "query"), await prefetch.page(input));
    return { title: `${category.label} | ${SITE}`, description: category.description || DEFAULT_DESCRIPTION, canonicalPath: `/category/${category.slug}`, ogImage: category.image, ogImageAlt: category.label, noindex: Boolean(tokens?.length) };
  }
  const productMatch = path.match(/^\/product\/([a-z0-9-]+)$/);
  if (productMatch) {
    const data = await prefetch.product({ slug: productMatch[1] });
    if (!data?.product) return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
    await seed(queryClient, getQueryKey(trpc.catalogue.product, { slug: productMatch[1] }, "query"), data);
    const product = data.product;
    return { title: product.metaTitle || `${product.name} | ${SITE}`, description: product.metaDescription || product.description || DEFAULT_DESCRIPTION, canonicalPath: `/product/${product.slug}`, ogImage: product.image, ogImageAlt: product.imageAlt, ogType: "product", noindex: product.metaRobots === "noindex,follow" };
  }
  const staticPages: Record<string, [string, string]> = { "/about": ["За ЖОАН", "Научете повече за строителен хипермаркет ЖОАН в Силистра."], "/contact": ["Контакти", "Свържете се с екипа на строителен хипермаркет ЖОАН."], "/delivery": ["Доставка", "Информация за доставка и потвърждение от екипа на ЖОАН."], "/terms": ["Условия за ползване", "Условия за ползване на онлайн каталога на ЖОАН."], "/faq": ["Често задавани въпроси", "Отговори на често задавани въпроси за ЖОАН."], "/returns": ["Връщане", "Информация за връщане на продукти от ЖОАН."] };
  if (staticPages[path]) return { title: `${staticPages[path][0]} | ${SITE}`, description: staticPages[path][1], canonicalPath: path };
  if (path === "/checkout" || path === "/favorites" || path.startsWith("/account") || path.startsWith("/admin")) return { title: SITE, description: DEFAULT_DESCRIPTION, noindex: true };
  return { title: SITE, description: DEFAULT_DESCRIPTION, notFound: true };
}
