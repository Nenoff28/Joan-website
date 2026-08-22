/** Red Workshop Modernism state: saved products are lightweight, local, and always reversible. */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { SlugMigration } from "./CartContext";

export function normalizeFavoriteSlugs(slugs: Set<string>, migrations: SlugMigration[]) {
  const replacements = new Map(migrations.filter((migration) => migration.from && migration.to && migration.from !== migration.to).map((migration) => [migration.from, migration.to]));
  if (!replacements.size) return slugs;
  const next = new Set(Array.from(slugs, (slug) => replacements.get(slug) ?? slug));
  return next.size === slugs.size && Array.from(next).every((slug) => slugs.has(slug)) ? slugs : next;
}

type FavoritesContextValue = {
  count: number;
  favoriteSlugs: string[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
  removeFavorite: (slug: string) => void;
  normalizeSlugs: (migrations: SlugMigration[]) => void;
  clearFavorites: () => void;
};

const FAVORITES_STORAGE_KEY = "joan-favorites";
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function readFavorites() {
  if (typeof window === "undefined") return new Set<string>();
  try {
    const stored = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? "[]");
    return new Set(Array.isArray(stored) ? stored.filter((slug): slug is string => typeof slug === "string") : []);
  } catch {
    return new Set<string>();
  }
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setFavoriteSlugs(readFavorites()); setHydrated(true); }, []);
  useEffect(() => {
    if (hydrated) localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteSlugs)));
  }, [favoriteSlugs, hydrated]);

  const toggleFavorite = useCallback((slug: string) => {
    setFavoriteSlugs((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }, []);

  const removeFavorite = useCallback((slug: string) => {
    setFavoriteSlugs((current) => {
      const next = new Set(current);
      next.delete(slug);
      return next;
    });
  }, []);

  const clearFavorites = useCallback(() => setFavoriteSlugs(new Set<string>()), []);
  const normalizeSlugs = useCallback((migrations: SlugMigration[]) => setFavoriteSlugs((current) => normalizeFavoriteSlugs(current, migrations)), []);
  const isFavorite = useCallback((slug: string) => favoriteSlugs.has(slug), [favoriteSlugs]);

  const value = useMemo(() => ({
    count: favoriteSlugs.size,
    favoriteSlugs: Array.from(favoriteSlugs),
    isFavorite,
    toggleFavorite,
    removeFavorite,
    normalizeSlugs,
    clearFavorites,
  }), [favoriteSlugs, isFavorite, toggleFavorite, removeFavorite, normalizeSlugs, clearFavorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within FavoritesProvider");
  return context;
}
