import { trpc } from "@/lib/trpc";
import { COOKIE_NAME, UNAUTHED_ERR_MSG } from "@shared/const";
import { HydrationBoundary, QueryClient, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { hydrateRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { startLogin } from "./const";
import "./index.css";

declare global { interface Window { __RQ_STATE__?: unknown } }

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });
const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError) || typeof window === "undefined" || error.message !== UNAUTHED_ERR_MSG) return;
  startLogin();
};
queryClient.getQueryCache().subscribe((event) => { if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.query.state.error); });
queryClient.getMutationCache().subscribe((event) => { if (event.type === "updated" && event.action.type === "error") redirectToLoginIfUnauthorized(event.mutation.state.error); });

const client = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson, headers() {
    try {
      const raw = sessionStorage.getItem("manus-cookie");
      const prefix = `${COOKIE_NAME}=`;
      const token = raw?.split(";").find((value) => value.trim().startsWith(prefix))?.trim().slice(prefix.length);
      return token ? { Authorization: `Bearer ${token}` } : {};
    } catch { return {}; }
  }, fetch(input, init) { return globalThis.fetch(input, { ...(init ?? {}), credentials: "include" }); } })],
});

const root = document.getElementById("root")!;
const state = window.__RQ_STATE__ ? superjson.deserialize(window.__RQ_STATE__ as any) as DehydratedState : undefined;
hydrateRoot(root, <trpc.Provider client={client} queryClient={queryClient}><QueryClientProvider client={queryClient}><HydrationBoundary state={state}><App /></HydrationBoundary></QueryClientProvider></trpc.Provider>);
