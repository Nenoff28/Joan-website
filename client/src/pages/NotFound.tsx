import { Button } from "@/components/ui/button";
import { PageMeta } from "@/components/Storefront";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "wouter";

export default function NotFound() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();

  const handleGoHome = () => {
    setLocation("/");
  };
  const handleGoCatalogue = () => {
    setLocation("/products");
  };

  return (
    <>
    <PageMeta title={language === "en" ? "Page not found" : "Страницата не е намерена"} description={language === "en" ? "The requested Joan page could not be found." : "Заявената страница в сайта на ЖОАН не е намерена."} metaRobots="noindex,follow" />
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <Card className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
              <AlertCircle className="relative h-16 w-16 text-red-500" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>

          <h2 className="text-xl font-semibold text-slate-700 mb-4">
            {language === "en" ? "Page not found" : "Страницата не е намерена"}
          </h2>

          <p className="text-slate-600 mb-8 leading-relaxed">
            {language === "en" ? "Sorry, the page you are looking for does not exist." : "Съжаляваме, страницата, която търсите, не съществува."}
            <br />
            {language === "en" ? "It may have been moved or deleted." : "Възможно е да е преместена или изтрита."}
          </p>

          <div
            id="not-found-button-group"
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button onClick={handleGoHome} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg">
              <Home className="w-4 h-4 mr-2" />
              {language === "en" ? "Go home" : "Към началото"}
            </Button>
            <Button onClick={handleGoCatalogue} variant="outline" className="px-6 py-2.5 rounded-lg">
              {language === "en" ? "Browse catalogue" : "Разгледайте каталога"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
