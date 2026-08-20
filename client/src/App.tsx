import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { useLayoutEffect } from "react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { FavoritesProvider } from "./contexts/FavoritesContext";
import Home from "./pages/Home";
import Category from "./pages/Category";
import { AllProducts } from "./pages/Category";
import Product from "./pages/Product";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Delivery from "./pages/Delivery";
import Terms from "./pages/Terms";
import Checkout from "./pages/Checkout";
import Favorites from "./pages/Favorites";
import Admin from "./pages/Admin";
import FAQ from "./pages/FAQ";
import Returns from "./pages/Returns";

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

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <>
      <ScrollToTop />
      <Switch>
        <Route path={"/"} component={Home} />
        <Route path={"/products"} component={AllProducts} />
        <Route path={"/category/:slug"} component={Category} />
        <Route path={"/product/:slug"} component={Product} />
        <Route path={"/about"} component={About} />
        <Route path={"/contact"} component={Contact} />
        <Route path={"/delivery"} component={Delivery} />
        <Route path={"/terms"} component={Terms} />
        <Route path={"/faq"} component={FAQ} />
        <Route path={"/checkout"} component={Checkout} />
        <Route path={"/favorites"} component={Favorites} />
        <Route path={"/returns"} component={Returns} />
        <Route path={"/admin/:section"} component={Admin} />
        <Route path={"/admin"} component={Admin} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <LanguageProvider>
          <FavoritesProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </FavoritesProvider>
        </LanguageProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
