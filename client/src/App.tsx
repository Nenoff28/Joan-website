import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { useLanguage } from "./contexts/LanguageContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import { CartProvider } from "./contexts/CartContext";
import Home from "./pages/Home";
import Category, { AllProducts } from "./pages/Category";
import Product from "./pages/Product";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Delivery from "./pages/Delivery";
import Terms from "./pages/Terms";
import FAQ from "./pages/FAQ";
import Returns from "./pages/Returns";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import Favorites from "./pages/Favorites";
import CustomerAccount, { CustomerActivation } from "./pages/CustomerAccount";

const Admin = lazy(() => import("./pages/Admin"));

function ScrollToTop() {
  const [location] = useLocation();

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousScrollBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    const faqAnchorFrame = window.requestAnimationFrame(() => {
      const anchorId = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      if (anchorId) document.getElementById(anchorId)?.scrollIntoView({ behavior: "auto", block: "start" });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(faqAnchorFrame);
      root.style.scrollBehavior = previousScrollBehavior;
    };
  }, [location]);

  return null;
}

function AppRoutes() {
  const { language } = useLanguage();
  return (
    <Suspense fallback={<main className="page-frame"><p className="py-12 text-sm text-slate-600">{language === "en" ? "Loading…" : "Зареждане…"}</p></main>}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path={"/products"} component={AllProducts} />
        <Route path="/category/:slug" component={Category} />
        <Route path="/product/:slug" component={Product} />
        <Route path="/about" component={About} />
        <Route path="/contact" component={Contact} />
        <Route path="/delivery" component={Delivery} />
        <Route path="/terms" component={Terms} />
        <Route path={"/faq"} component={FAQ} />
        <Route path="/checkout" component={Checkout} />
        <Route path="/favorites" component={Favorites} />
        <Route path={"/returns"} component={Returns} />
        <Route path="/account/activate" component={CustomerActivation} />
        <Route path="/account" component={CustomerAccount} />
        <Route path={"/admin/:section"} component={Admin} />
        <Route path="/admin" component={Admin} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

export function AppContent() {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  return (
    <>
      {isHydrated ? <ScrollToTop /> : null}
      <AppRoutes />
    </>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <CartProvider>
            <FavoritesProvider>
              <TooltipProvider>
                <Toaster />
                <AppContent />
              </TooltipProvider>
            </FavoritesProvider>
          </CartProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
