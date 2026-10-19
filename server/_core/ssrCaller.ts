import type { Request, Response } from "express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import type { SsrPrefetch } from "../../client/src/ssr/prefetch";

export async function buildSsrPrefetch(req: Request, res: Response): Promise<SsrPrefetch> {
  const context = await createContext({ req, res } as any);
  const caller = appRouter.createCaller(context);
  return { metadata: (input) => caller.catalogue.metadata({ language: input?.language ?? "bg" }), page: (input) => caller.catalogue.page(input), bestSellers: (input) => caller.catalogue.bestSellers({ language: input?.language ?? "bg" }), product: (input) => caller.catalogue.product({ ...input, language: input.language ?? "bg" }), brochure: () => caller.catalogue.brochure() };
}
