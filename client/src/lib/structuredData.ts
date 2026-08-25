import type { Product } from "@/lib/storeData";

type SeoProduct = Product & { sku?: string };

function cleanString(value: string | undefined) {
  const trimmed = value?.replace(/\s+/g, " ").trim();
  return trimmed || undefined;
}

function priceNumber(value: string | undefined) {
  const numeric = Number(value?.replace("€", "").trim());
  return Number.isFinite(numeric) ? numeric.toFixed(2) : undefined;
}

export function productStructuredData(product: SeoProduct) {
  const price = priceNumber(product.price);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: cleanString(product.name),
    sku: cleanString(product.sku),
    brand: cleanString(product.brand) ? { "@type": "Brand", name: cleanString(product.brand) } : undefined,
    image: Array.from(new Set([product.image, ...(product.gallery ?? [])].filter(Boolean))),
    description: cleanString(product.description),
    offers: price ? {
      "@type": "Offer",
      priceCurrency: "EUR",
      price,
      availability: product.availabilityCode === "out_of_stock"
        ? "https://schema.org/OutOfStock"
        : product.availabilityCode === "in_stock"
          ? "https://schema.org/InStock"
          : "https://schema.org/LimitedAvailability",
    } : undefined,
  };
}

export function organizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "HardwareStore",
    name: "ЖОАН",
    email: "info@joan.bg",
    telephone: "(0884) 742 770",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ул. Тутракан №22",
      addressLocality: "Силистра",
      addressCountry: "BG",
    },
  };
}

export function safeJsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}
