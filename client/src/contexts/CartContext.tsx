/** Cart state is local, persistent, and intentionally separate from the future OpenCart/Zeron order backend. */
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = { slug: string; quantity: number };

type CartContextValue = {
  items: CartLine[];
  count: number;
  addItem: (slug: string, quantity?: number) => void;
  setQuantity: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clearCart: () => void;
};

const CART_STORAGE_KEY = "joan-cart";
const CartContext = createContext<CartContextValue | null>(null);

function readCart(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((item) => typeof item?.slug === "string" && Number.isFinite(item?.quantity) && item.quantity > 0 ? [{ slug: item.slug, quantity: Math.min(Math.floor(item.quantity), 99) }] : []);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>([]);

  useEffect(() => { setItems(readCart()); }, []);
  useEffect(() => { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)); }, [items]);

  const addItem = useCallback((slug: string, quantity = 1) => {
    const safeQuantity = Math.max(1, Math.min(Math.floor(quantity) || 1, 99));
    setItems((current) => {
      const existing = current.find((item) => item.slug === slug);
      return existing ? current.map((item) => item.slug === slug ? { ...item, quantity: Math.min(item.quantity + safeQuantity, 99) } : item) : [...current, { slug, quantity: safeQuantity }];
    });
  }, []);

  const setQuantity = useCallback((slug: string, quantity: number) => {
    setItems((current) => quantity < 1 ? current.filter((item) => item.slug !== slug) : current.map((item) => item.slug === slug ? { ...item, quantity: Math.min(Math.floor(quantity), 99) } : item));
  }, []);

  const removeItem = useCallback((slug: string) => setItems((current) => current.filter((item) => item.slug !== slug)), []);
  const clearCart = useCallback(() => setItems([]), []);
  const count = useMemo(() => items.reduce((total, item) => total + item.quantity, 0), [items]);
  const value = useMemo(() => ({ items, count, addItem, setQuantity, removeItem, clearCart }), [items, count, addItem, setQuantity, removeItem, clearCart]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
