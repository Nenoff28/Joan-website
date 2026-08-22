import express, { type Express } from "express";
import fs from "fs";
import type { Request, Response } from "express";
import { type Server } from "http";
import { nanoid } from "nanoid";
import path from "path";
import superjson from "superjson";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { buildSsrPrefetch } from "./ssrCaller";
import type { HeadMeta } from "../../client/src/ssr/prefetch";
import { getPublicProductBySlug, getPublicSitemapEntries } from "../catalogueService";

const canonicalOrigin = (process.env.CANONICAL_ORIGIN ?? "").replace(/\/+$/, "");
const siteName = process.env.SITE_NAME ?? "ЖОАН";
const escapeHtml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const compact = (value: string, max: number) => { const normalized = value.replace(/\s+/g, " ").trim(); return normalized.length > max ? `${normalized.slice(0, max - 1).trimEnd()}…` : normalized; };
function headTags(head: HeadMeta) {
  const title = escapeHtml(compact(head.title || siteName, 70));
  const description = escapeHtml(compact(head.description, 200));
  const canonical = head.canonicalPath && canonicalOrigin ? `${canonicalOrigin}${head.canonicalPath}` : "";
  const image = head.ogImage?.startsWith("/") && canonicalOrigin ? `${canonicalOrigin}${head.ogImage}` : head.ogImage;
  return [
    `<title>${title}</title>`, `<meta name="description" content="${description}" />`, `<meta property="og:type" content="${head.ogType === "product" ? "product" : "website"}" />`, `<meta property="og:title" content="${title}" />`, `<meta property="og:description" content="${description}" />`, `<meta property="og:locale" content="bg_BG" />`, `<meta property="og:site_name" content="${escapeHtml(siteName)}" />`, `<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />`, `<meta name="twitter:title" content="${title}" />`, `<meta name="twitter:description" content="${description}" />`,
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" /><meta property="og:url" content="${escapeHtml(canonical)}" />` : "",
    image ? `<meta property="og:image" content="${escapeHtml(image)}" /><meta name="twitter:image" content="${escapeHtml(image)}" />${head.ogImageAlt ? `<meta property="og:image:alt" content="${escapeHtml(head.ogImageAlt)}" />` : ""}` : "",
    head.noindex || head.notFound ? `<meta name="robots" content="noindex, follow" />` : `<meta name="robots" content="index, follow, max-image-preview:large" />`,
  ].filter(Boolean).join("\n");
}
function compose(template: string, html: string, head: HeadMeta, state: unknown) {
  const stateJson = JSON.stringify(superjson.serialize(state)).replace(/</g, "\\u003c");
  return template.replace("</body>", () => `<script>window.__RQ_STATE__=${stateJson}</script></body>`).replace("<!--app-head-->", () => headTags(head)).replace("<!--app-html-->", () => html);
}
function normalizePath(reqPath: string, originalUrl: string) { const query = originalUrl.slice(reqPath.length); return (reqPath.replace(/\/+$/, "") || "/").replace(/^\/\/+/, "/") + query; }
async function canonicalProductRedirect(req: Request, res: Response) {
  const requestUrl = new URL(req.originalUrl, "http://localhost");
  const match = requestUrl.pathname.match(/^\/product\/([a-z0-9-]+)$/);
  if (!match) return false;
  const found = await getPublicProductBySlug(match[1]);
  if (found && found.product.slug !== match[1]) {
    res.redirect(301, `/product/${found.product.slug}${requestUrl.search}`);
    return true;
  }
  return false;
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({ ...viteConfig, configFile: false, server: { middlewareMode: true, hmr: { server }, allowedHosts: true }, appType: "custom" });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      if (await canonicalProductRedirect(req, res)) return;
      let template = await fs.promises.readFile(path.resolve(import.meta.dirname, "../..", "client", "index.html"), "utf-8");
      template = template.replace(`src="/src/entry-client.tsx"`, `src="/src/entry-client.tsx?v=${nanoid()}"`);
      template = await vite.transformIndexHtml(req.originalUrl, template);
      template = template.replace("</head>", `<link rel="stylesheet" href="/src/index.css?direct" data-ssr-dev-css></head>`);
      const { render } = await vite.ssrLoadModule("/src/entry-server.tsx");
      const result = await render(req.originalUrl, await buildSsrPrefetch(req, res));
      res.status(result.head.notFound ? 404 : 200).set("Cache-Control", "no-cache").type("html").end(compose(template, result.html, result.head, result.dehydratedState));
    } catch (error) { vite.ssrFixStacktrace(error as Error); next(error); }
  });
}

export function serveStatic(app: Express) {
  const distPath = process.env.NODE_ENV === "development" ? path.resolve(import.meta.dirname, "../..", "dist", "public") : path.resolve(import.meta.dirname, "public");
  app.get("/robots.txt", (_req, res) => res.type("text/plain").send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /checkout\nDisallow: /favorites\nSitemap: ${canonicalOrigin}/sitemap.xml\n`));
  app.get("/sitemap.xml", async (_req, res, next) => {
    try {
      const entries = await getPublicSitemapEntries();
      const fixed = ["/", "/products", "/about", "/contact", "/delivery", "/terms", "/faq", "/returns"];
      const urls = [...fixed.map((path) => ({ path, updatedAt: new Date() })), ...entries.categories.map((entry) => ({ path: `/category/${entry.slug}`, updatedAt: entry.updatedAt })), ...entries.products.map((entry) => ({ path: `/product/${entry.slug}`, updatedAt: entry.updatedAt }))];
      const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((entry) => `<url><loc>${escapeHtml(`${canonicalOrigin}${entry.path}`)}</loc><lastmod>${new Date(entry.updatedAt).toISOString().slice(0, 10)}</lastmod></url>`).join("")}</urlset>`;
      res.type("application/xml").send(xml);
    } catch (error) { next(error); }
  });
  app.use((req, res, next) => {
    if (req.path === "/index.html") return res.redirect(301, "/");
    if (req.path !== "/" && /\/+$/ .test(req.path)) return res.redirect(301, normalizePath(req.path, req.originalUrl));
    next();
  });
  app.use(express.static(distPath, { index: false, redirect: false }));
  app.use("*", async (req, res) => {
    if (await canonicalProductRedirect(req, res)) return;
    const template = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");
    try {
      const { render } = await import(path.resolve(import.meta.dirname, "server-ssr", "entry-server.js"));
      const result = await render(req.originalUrl, await buildSsrPrefetch(req, res));
      res.status(result.head.notFound ? 404 : 200).set("Cache-Control", "no-cache").type("html").end(compose(template, result.html, result.head, result.dehydratedState));
    } catch (error) {
      console.error("[SSR] render failed, serving shell:", error);
      res.status(200).set("Cache-Control", "no-cache").type("html").end(template.replace("<!--app-head-->", () => headTags({ title: siteName, description: "Онлайн каталог на ЖОАН." })).replace("<!--app-html-->", () => ""));
    }
  });
}
