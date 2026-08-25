import type { NextFunction, Request, Response } from "express";
import { nanoid } from "nanoid";

const isProduction = process.env.NODE_ENV === "production";

export function buildContentSecurityPolicy(nonce: string) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://d36hbw14aib5lz.cloudfront.net",
    "media-src 'self' https://d36hbw14aib5lz.cloudfront.net",
    "font-src 'self' data: https://fonts.gstatic.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    `script-src 'self' 'nonce-${nonce}' https://manus-analytics.com`,
    "connect-src 'self' https://manus-analytics.com",
    "manifest-src 'self'",
  ].join("; ");
}

export function applySecurityHeaders(req: Request, res: Response, next: NextFunction) {
  const nonce = nanoid(24);
  res.locals.cspNonce = nonce;
  res.setHeader("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  if (isProduction) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}
