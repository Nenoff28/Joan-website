import { renderToString } from "react-dom/server";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import { Router } from "wouter";
import superjson from "superjson";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "@/lib/trpc";
import SsrApp from "./SsrApp";
import { prefetchForPath, type HeadMeta, type SsrPrefetch } from "./ssr/prefetch";

export async function render(url: string, prefetch: SsrPrefetch) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
  const splitAt = url.indexOf("?");
  const ssrPath = splitAt === -1 ? url : url.slice(0, splitAt);
  const ssrSearch = splitAt === -1 ? "" : url.slice(splitAt + 1);
  const head = await prefetchForPath(url, queryClient, prefetch);
  const client = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] });
  const html = renderToString(<trpc.Provider client={client} queryClient={queryClient}><QueryClientProvider client={queryClient}><Router ssrPath={ssrPath} ssrSearch={ssrSearch}><SsrApp /></Router></QueryClientProvider></trpc.Provider>);
  return { html, dehydratedState: dehydrate(queryClient), head: head as HeadMeta };
}
