import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { FavoritesProvider } from "@/contexts/FavoritesContext";
import { CartProvider } from "@/contexts/CartContext";
import Home from "@/pages/Home";
import Category, { AllProducts } from "@/pages/Category";
import Product from "@/pages/Product";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Delivery from "@/pages/Delivery";
import Terms from "@/pages/Terms";
import FAQ from "@/pages/FAQ";
import Returns from "@/pages/Returns";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";

function PublicRoutes() {
  return <Switch>
    <Route path="/" component={Home} />
    <Route path="/products" component={AllProducts} />
    <Route path="/category/:slug" component={Category} />
    <Route path="/product/:slug" component={Product} />
    <Route path="/about" component={About} />
    <Route path="/contact" component={Contact} />
    <Route path="/delivery" component={Delivery} />
    <Route path="/terms" component={Terms} />
    <Route path="/faq" component={FAQ} />
    <Route path="/returns" component={Returns} />
    <Route component={NotFound} />
  </Switch>;
}

export default function SsrApp() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><LanguageProvider><CartProvider><FavoritesProvider><TooltipProvider><Toaster /><PublicRoutes /></TooltipProvider></FavoritesProvider></CartProvider></LanguageProvider></ThemeProvider></ErrorBoundary>;
}
