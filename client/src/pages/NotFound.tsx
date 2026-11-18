import { Layout, PageMeta } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import { ArrowRight, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";

export default function NotFound() {
  const { language } = useLanguage();
  const en = language === "en";
  const [, setLocation] = useLocation();
  const [query, setQuery] = useState("");

  function search(event: FormEvent) {
    event.preventDefault();
    const term = query.trim();
    setLocation(term ? `/products?query=${encodeURIComponent(term)}` : "/products");
  }

  return (
    <Layout>
      <PageMeta title={en ? "Page not found" : "Страницата не е намерена"} description={en ? "The requested Joan page could not be found." : "Заявената страница в сайта на ЖОАН не е намерена."} metaRobots="noindex,follow" />
      <main className="page-frame not-found-page">
        <p className="not-found-code">404</p>
        <h1>{en ? "Page not found" : "Страницата не е намерена"}</h1>
        <p>{en ? "The page may have been moved or deleted. Search the catalogue or go back to the start." : "Страницата може да е преместена или изтрита. Потърсете в каталога или се върнете в началото."}</p>
        <form className="not-found-search" onSubmit={search} role="search">
          <label htmlFor="not-found-search" className="sr-only">{en ? "Search the catalogue" : "Търсене в каталога"}</label>
          <Search size={18} aria-hidden="true" />
          <input id="not-found-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={en ? "Product, brand or model code" : "Продукт, марка или код"} autoComplete="off" />
          <button type="submit">{en ? "Search" : "Търси"}</button>
        </form>
        <div className="not-found-links">
          <Link href="/" className="button-solid">{en ? "Go home" : "Към началото"} <ArrowRight size={17} /></Link>
          <Link href="/products" className="text-link">{en ? "Browse catalogue" : "Разгледайте каталога"} <ArrowRight size={16} /></Link>
        </div>
      </main>
    </Layout>
  );
}
