import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import "./cookieConsent.css";

const CONSENT_KEY = "joan-cookie-consent";
const ANALYTICS_ID = "joan-analytics";

type Consent = "accepted" | "rejected" | null;

function loadAnalytics() {
  const endpoint = String(import.meta.env.VITE_ANALYTICS_ENDPOINT ?? "").replace(/\/+$/, "");
  const websiteId = String(import.meta.env.VITE_ANALYTICS_WEBSITE_ID ?? "");
  if (!endpoint || !websiteId || document.getElementById(ANALYTICS_ID)) return;
  const script = document.createElement("script");
  script.id = ANALYTICS_ID;
  script.defer = true;
  script.src = `${endpoint}/umami`;
  script.dataset.websiteId = websiteId;
  document.body.appendChild(script);
}

function removeAnalytics() {
  document.getElementById(ANALYTICS_ID)?.remove();
}

export default function CookieConsent() {
  const { language } = useLanguage();
  const en = language === "en";
  const [consent, setConsent] = useState<Consent>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem(CONSENT_KEY) as Consent;
    if (stored === "accepted") {
      setConsent(stored);
      loadAnalytics();
    } else if (stored === "rejected") {
      setConsent(stored);
      removeAnalytics();
    }
  }, []);

  const choose = (value: Exclude<Consent, null>) => {
    window.localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
    if (value === "accepted") loadAnalytics();
    else removeAnalytics();
  };

  if (consent) return <button type="button" className="cookie-settings-trigger" onClick={() => setConsent(null)} aria-label={en ? "Change privacy choices" : "Промени избора за поверителност"}>{en ? "Privacy" : "Поверителност"}</button>;
  return <aside className="cookie-consent" role="dialog" aria-live="polite" aria-label={en ? "Cookie preferences" : "Настройки за бисквитки"}><div className="cookie-consent-copy"><strong>{en ? "Privacy choices" : "Вашият избор за поверителност"}</strong><p>{en ? "We use necessary storage for site features. Optional, privacy-friendly analytics is loaded only if you accept." : "Използваме необходимо съхранение за функциите на сайта. Незадължителната, съобразена с поверителността статистика се зарежда само след приемане."} <Link href="/privacy">{en ? "Privacy Policy" : "Политика за поверителност"}</Link></p></div><div className="cookie-consent-actions"><button type="button" className="cookie-reject" onClick={() => choose("rejected")}>{en ? "Reject optional" : "Отказвам незадължителните"}</button><button type="button" className="cookie-accept" onClick={() => choose("accepted")}>{en ? "Accept analytics" : "Приемам статистиката"}</button></div></aside>;
}
