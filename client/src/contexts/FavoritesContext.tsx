/** Red Workshop Modernism state: saved products are lightweight, local, and always reversible. */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

type FavoritesContextValue = {
  count: number;
  favoriteSlugs: string[];
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
  removeFavorite: (slug: string) => void;
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
  const [favoriteSlugs, setFavoriteSlugs] = useState<Set<string>>(readFavorites);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(favoriteSlugs)));
  }, [favoriteSlugs]);

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
  const isFavorite = useCallback((slug: string) => favoriteSlugs.has(slug), [favoriteSlugs]);

  const value = useMemo(() => ({
    count: favoriteSlugs.size,
    favoriteSlugs: Array.from(favoriteSlugs),
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearFavorites,
  }), [favoriteSlugs, isFavorite, toggleFavorite, removeFavorite, clearFavorites]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used within FavoritesProvider");
  return context;
}
