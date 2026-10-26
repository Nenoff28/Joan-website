import "dotenv/config";
import express, { type Express } from "express";
import compression from "compression";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGoogleCustomerAuthRoutes } from "../googleCustomerAuth";
import { applySecurityHeaders } from "./security";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveProductionStatic } from "./production";

/** Builds the production Express app without importing Vite or development tooling. */
export async function createProductionApp(): Promise<Express> {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    const app = express();
    app.disable("x-powered-by");
    app.use(applySecurityHeaders);
    app.use(compression({ threshold: 1024, level: 6 }));
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "1mb", extended: true }));
    registerStorageProxy(app);
    registerOAuthRoutes(app);
    registerGoogleCustomerAuthRoutes(app);
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
    serveProductionStatic(app);
    return app;
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  }
}
