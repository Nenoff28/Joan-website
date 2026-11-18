import { QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { describe, expect, it } from "vitest";
import { trpc } from "../client/src/lib/trpc";
import { prefetchForPath, type SsrPrefetch } from "../client/src/ssr/prefetch";

const product = { slug: "test-produkt", name: "Тестов продукт", description: "Описание", image: "/media/a.webp", imageAlt: "", metaTitle: null, metaDescription: null };
const stubs: SsrPrefetch = {
  metadata: async () => ({ categories: [] }),
  page: async () => ({ products: [], total: 0 }),
  bestSellers: async () => [],
  brochure: async () => null,
  product: async () => ({ product, related: [] }),
} as unknown as SsrPrefetch;

describe("SSR product prefetch", () => {
  it("seeds the exact query key the product page reads, so SSR renders the product instead of a loading state", async () => {
    const queryClient = new QueryClient();
    await prefetchForPath("/product/test-produkt", queryClient, stubs);
    // Must match useCatalogueProduct: trpc.catalogue.product.useQuery({ slug, language })
    const key = getQueryKey(trpc.catalogue.product, { slug: "test-produkt", language: "bg" }, "query");
    expect(queryClient.getQueryData(key)).toMatchObject({ product: { slug: "test-produkt" } });
  });
});
