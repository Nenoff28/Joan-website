import type { Request, Response } from "express";
import { appRouter } from "../routers";
import { createContext } from "./context";
import type { SsrPrefetch } from "../../client/src/ssr/prefetch";

export async function buildSsrPrefetch(req: Request, res: Response): Promise<SsrPrefetch> {
  const context = await createContext({ req, res } as any);
  const caller = appRouter.createCaller(context);
  return { metadata: () => caller.catalogue.metadata(), page: (input) => caller.catalogue.page(input), bestSellers: () => caller.catalogue.bestSellers(), product: (input) => caller.catalogue.product(input), brochure: () => caller.catalogue.brochure() };
}
