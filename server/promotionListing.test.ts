import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QueryClient } from "@tanstack/react-query";
import { getQueryKey } from "@trpc/react-query";
import { describe, expect, it, vi } from "vitest";
import {
  isPromotionFilter,
  withPromotionFilter,
} from "../shared/catalogueFilters";
import { prefetchForPath, type SsrPrefetch } from "../client/src/ssr/prefetch";
import { trpc } from "../client/src/lib/trpc";

function fixture(): SsrPrefetch {
  return {
    metadata: vi.fn(async () => ({
      categories: [
        { slug: "instrumenti", label: "Инструменти", subcategories: [] },
      ],
    })),
    page: vi.fn(async input => ({
      products: [],
      brands: [],
      total: input.promotion ? 50 : 7000,
      page: input.page,
      pageSize: input.pageSize,
    })),
    bestSellers: vi.fn(async () => []),
    product: vi.fn(async () => null),
    brochure: vi.fn(async () => null),
  };
}

describe("promotion catalogue URL and SSR", () => {
  it("enables only the explicit promotion=1 parameter", () => {
    expect(isPromotionFilter("promotion=1")).toBe(true);
    expect(isPromotionFilter("?path=drills&promotion=1")).toBe(true);
    for (const query of [
      "",
      "promotion=0",
      "promotion=false",
      "promotion=true",
      "utm=promotion%3D1",
    ])
      expect(isPromotionFilter(query)).toBe(false);
  });

  it("can enable and remove the promotion flag while preserving a Latin category path", () => {
    expect(withPromotionFilter("/products", "", true)).toBe(
      "/products?promotion=1"
    );
    expect(
      withPromotionFilter(
        "/category/instrumenti",
        "path=elektroinstrumenti&promotion=1",
        false
      )
    ).toBe("/category/instrumenti?path=elektroinstrumenti");
    expect(withPromotionFilter("/products", "promotion=1", false)).toBe(
      "/products"
    );
  });

  it("prefetches the promotion results under the exact initial client query key", async () => {
    const queryClient = new QueryClient();
    const api = fixture();
    const head = await prefetchForPath(
      "/products?promotion=1&utm_source=test",
      queryClient,
      api
    );
    const input = {
      page: 1,
      pageSize: 48,
      language: "bg" as const,
      availability: [],
      promotion: true,
      sort: "relevance" as const,
    };
    expect(api.page).toHaveBeenCalledWith(input);
    expect(
      queryClient.getQueryData(getQueryKey(trpc.catalogue.page, input, "query"))
    ).toMatchObject({ total: 50 });
    expect(head.title).toBe("Продукти на промоция | ЖОАН");
    expect(head.canonicalPath).toBe("/products?promotion=1");
  });

  it("does not enable promotions for the ordinary catalogue and preserves category filtering", async () => {
    const api = fixture();
    const head = await prefetchForPath("/products", new QueryClient(), api);
    expect(head.canonicalPath).toBe("/products");
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({ promotion: undefined })
    );
    await prefetchForPath(
      "/category/instrumenti?path=elektroinstrumenti&promotion=1",
      new QueryClient(),
      api
    );
    expect(api.page).toHaveBeenLastCalledWith(
      expect.objectContaining({
        categorySlug: "instrumenti",
        path: ["elektroinstrumenti"],
        promotion: true,
      })
    );
  });

  it("prefetches and canonicalizes a directly requested catalogue page", async () => {
    const queryClient = new QueryClient();
    const api = fixture();
    const head = await prefetchForPath("/products?page=2", queryClient, api);
    const input = {
      page: 2,
      pageSize: 48,
      language: "bg" as const,
      availability: [],
      promotion: undefined,
      sort: "relevance" as const,
    };
    expect(api.page).toHaveBeenCalledWith(input);
    expect(queryClient.getQueryData(getQueryKey(trpc.catalogue.page, input, "query"))).toMatchObject({ page: 2 });
    expect(head.canonicalPath).toBe("/products?page=2");
  });

  it("links the homepage CTA to the full filtered catalogue and includes the shared checkbox", () => {
    const home = readFileSync(
      resolve(process.cwd(), "client/src/pages/Home.tsx"),
      "utf8"
    );
    const category = readFileSync(
      resolve(process.cwd(), "client/src/pages/Category.tsx"),
      "utf8"
    );
    expect(category).toContain("if (cataloguePage.data && page > totalPages)");
    expect(home).toContain('href="/products?promotion=1"');
    expect(home).not.toContain('href="#current-offers"');
    expect(category).toContain("checked={promotion}");
    expect(category).toContain("promotion: promotion || undefined");
    expect(category).toContain("setPromotionFilter(event.target.checked)");
    expect(category).toContain("onClick={clearFilters}");
    expect(category).toContain('"Promotion" : "Промоция"');
  });
});

it("preserves the URL search snapshot during the first hydration render", () => {
  const entry = readFileSync(
    resolve(process.cwd(), "client/src/entry-client.tsx"),
    "utf8"
  );
  expect(entry).toContain(
    "const initialSearch = window.location.search.slice(1)"
  );
  expect(entry).toContain("ssrSearch={initialSearch}");
  expect(entry).toContain("ssrPath={initialPath}");
});
