import { JsonLd, Layout, PageMeta } from "@/components/Storefront";
import { trpc } from "@/lib/trpc";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckCircle2, Globe2, KeyRound, Loader2, LogIn, LogOut, MapPin, ShieldCheck, UserPlus } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation, useSearch } from "wouter";

function AccountShell({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return <Layout><PageMeta title={title} description={description} /><JsonLd /><main className="account-page"><section className="page-frame account-frame">{children}</section></main></Layout>;
}

export default function CustomerAccount() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const account = trpc.customer.me.useQuery();
  const utils = trpc.useUtils();
  const googleStatus = trpc.customer.googleStatus.useQuery();
  const staff = trpc.staff.me.useQuery(undefined, { enabled: Boolean(account.data), retry: false });
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const notice = useMemo(() => {
    const google = new URLSearchParams(search).get("google");
    if (google === "success") return language === "en" ? "You signed in with Google successfully." : "Влязохте успешно с Google.";
    if (google === "conflict") return language === "en" ? "This Google account matches an existing customer. Sign in with the existing password first; Google was not linked automatically." : "Този Google профил съвпада със съществуващ клиент. Първо влезте със съществуващата парола; Google не беше свързан автоматично.";
    if (google === "error") return language === "en" ? "Google sign-in could not be completed. No account was changed." : "Входът с Google не завърши успешно. Няма променен профил.";
    return "";
  }, [language, search]);
  const refreshAuth = async () => {
    await Promise.all([utils.customer.me.invalidate(), utils.staff.me.invalidate(), account.refetch(), staff.refetch()]);
  };
  const login = trpc.customer.login.useMutation({
    onSuccess: async () => { await refreshAuth(); toast.success(language === "en" ? "You signed in successfully." : "Влязохте успешно в профила си."); },
    onError: (mutationError) => { setError(mutationError.message || (language === "en" ? "Sign-in was not successful. Check your details." : "Входът не е успешен. Проверете данните си.")); },
  });
  const register = trpc.customer.register.useMutation({
    onSuccess: async () => { await refreshAuth(); toast.success(language === "en" ? "Your customer profile was created." : "Вашият клиентски профил е създаден."); },
    onError: (mutationError) => { setError(mutationError.message || (language === "en" ? "Registration was not successful." : "Регистрацията не е успешна.")); },
  });
  const logout = trpc.customer.logout.useMutation({ onSuccess: async () => { await refreshAuth(); toast.success(language === "en" ? "You signed out of your account." : "Излязохте от профила си."); setLocation("/"); } });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (authMode === "login") {
      if (!email || !password) { setError(language === "en" ? "Enter an email and password." : "Попълнете имейл и парола."); return; }
      setError("");
      login.mutate({ email, password });
      return;
    }
    const acceptedTerms = form.get("acceptedTerms") === "on";
    if (!String(form.get("firstName") ?? "").trim() || !String(form.get("lastName") ?? "").trim() || !email || password.length < 12 || !acceptedTerms) {
      setError(language === "en" ? "Enter your name, a valid email, a password of at least 12 characters, and accept the terms." : "Въведете име, валиден имейл, парола поне 12 символа и приемете условията."); return;
    }
    setError("");
    register.mutate({ firstName: String(form.get("firstName") ?? ""), lastName: String(form.get("lastName") ?? ""), email, phone: String(form.get("phone") ?? "").trim() || null, password, acceptedTerms: true });
  }

  if (account.isLoading) return <AccountShell title={language === "en" ? "Account" : "Профил"} description={language === "en" ? "Sign in to a Joan customer account." : "Вход в клиентски профил на Жоан."}><div className="account-loading"><Loader2 className="animate-spin" size={24} /> {language === "en" ? "Loading account…" : "Зареждане на профил…"}</div></AccountShell>;
  if (account.data) {
    const profile = account.data;
    return <AccountShell title={language === "en" ? "My account" : "Моят профил"} description={language === "en" ? "View your customer account, saved addresses and available order history." : "Преглед на клиентския профил, запазените адреси и наличната информация за поръчки."}>
      {notice && <p className={notice.includes("successfully") || notice.includes("успешно") ? "account-success" : "account-error"} role="status">{notice}</p>}
      <div className="account-hero"><p className="eyebrow">{language === "en" ? "CUSTOMER ACCOUNT" : "КЛИЕНТСКИ ПРОФИЛ"}</p><h1>{language === "en" ? "Hello" : "Здравейте"}, {profile.firstName}.</h1><p>{language === "en" ? "Your account and saved addresses are ready to use." : "Вашият профил и запазените адреси са готови за използване."}</p></div>
      <section className="account-card account-profile-card"><div><span className="account-icon"><ShieldCheck size={22} /></span><div><p className="eyebrow">{language === "en" ? "PROFILE DETAILS" : "ДАННИ ЗА ПРОФИЛА"}</p><h2>{profile.firstName} {profile.lastName}</h2><a href={`mailto:${profile.email}`}>{profile.email}</a>{profile.phone && <p>{profile.phone}</p>}</div></div><button type="button" className="button-outline" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={17} /> {language === "en" ? "Sign out" : "Изход"}</button></section>
      {staff.data?.canAccess && <section className="account-card"><p className="eyebrow">{language === "en" ? "STAFF ACCESS" : "СЛУЖЕБЕН ДОСТЪП"}</p><p>{language === "en" ? "Your customer profile has staff access." : "Към клиентския профил е предоставен служебен достъп."}</p><Link className="button-outline" href="/admin">{language === "en" ? "Open admin panel" : "Отвори админ панела"}</Link></section>}
      <section className="account-address-section"><div><p className="eyebrow">{language === "en" ? "SAVED ADDRESSES" : "ЗАПАЗЕНИ АДРЕСИ"}</p><h2>{language === "en" ? "Delivery addresses" : "Адреси за доставка"}</h2></div>{profile.addresses.length ? <div className="account-address-grid">{profile.addresses.map((address) => <article key={address.id} className="account-address-card"><MapPin size={20} /><div><b>{address.firstName} {address.lastName}</b>{address.company && <span>{address.company}</span>}<span>{address.addressLine1}</span>{address.addressLine2 && <span>{address.addressLine2}</span>}<span>{address.postcode ? `${address.postcode} ` : ""}{address.city}</span>{address.zone && <span>{address.zone}</span>}{address.country && <span>{address.country}</span>}{address.isDefault && <small>{language === "en" ? "Default address" : "Основен адрес"}</small>}</div></article>)}</div> : <p className="account-empty">{language === "en" ? "There is no saved address for this account yet." : "Към профила все още няма запазен адрес."}</p>}</section>
      <section className="account-history-section"><div><p className="eyebrow">{language === "en" ? "ORDER HISTORY" : "ИСТОРИЯ НА ПОРЪЧКИТЕ"}</p><h2>{language === "en" ? "Previous orders" : "Предишни заявки"}</h2><p>{language === "en" ? "Orders linked to this customer account are shown here." : "Тук се показват поръчките, свързани с този клиентски профил."}</p></div>{profile.historicalOrders.length ? <div className="account-history-list">{profile.historicalOrders.map((order) => <details key={order.legacyOrderId} className="account-history-order"><summary><span><b>{language === "en" ? "Order" : "Поръчка"} №{order.legacyOrderId}</b><small>{new Date(order.orderedAt).toLocaleDateString(language === "en" ? "en-GB" : "bg-BG", { dateStyle: "medium" })}</small></span><span><em>{order.orderStatus}</em><strong>{Number(order.totalInOrderCurrency ?? order.total).toFixed(2)} {order.currencyCode}</strong></span></summary><div>{order.lines.map((line, index) => <p key={`${line.productName}-${index}`}><span>{line.productName}{line.productModel ? ` · ${line.productModel}` : ""} × {line.quantity}</span><b>{Number(line.lineTotal).toFixed(2)} {order.currencyCode}</b></p>)}</div></details>)}</div> : <p className="account-empty">{language === "en" ? "There are no previous orders linked to this account." : "Няма предишни поръчки, свързани с този профил."}</p>}</section>
    </AccountShell>;
  }

  const pending = login.isPending || register.isPending;
  return <AccountShell title={authMode === "login" ? (language === "en" ? "Sign in" : "Вход") : (language === "en" ? "Create account" : "Регистрация")} description={language === "en" ? "Sign in or create a Joan customer account." : "Влезте или създайте клиентски профил на Жоан."}><div className="account-auth-grid"><section className="account-hero"><p className="eyebrow">{language === "en" ? "CUSTOMER ACCOUNT" : "КЛИЕНТСКИ ПРОФИЛ"}</p><h1>{authMode === "login" ? (language === "en" ? "Sign in to your account." : "Влезте в своя профил.") : (language === "en" ? "Create your customer profile." : "Създайте своя клиентски профил.")}</h1><p>{language === "en" ? "Use your profile for saved addresses and future orders." : "Използвайте профила си за запазени адреси и бъдещи поръчки."}</p><div className="account-note"><KeyRound size={20} /><span><b>{language === "en" ? "Security first." : "Сигурността е на първо място."}</b> {language === "en" ? "Google accounts are never silently linked to an existing password profile." : "Google профили никога не се свързват автоматично със съществуващ профил с парола."}</span></div></section><form className="account-card account-login-form" onSubmit={submit} noValidate><div><p className="eyebrow">{authMode === "login" ? (language === "en" ? "SIGN IN" : "ВХОД") : (language === "en" ? "REGISTER" : "РЕГИСТРАЦИЯ")}</p><h2>{authMode === "login" ? (language === "en" ? "Welcome back" : "Добре дошли отново") : (language === "en" ? "New customer" : "Нов клиент")}</h2></div>{authMode === "register" && <><label>{language === "en" ? "First name" : "Име"}<input name="firstName" autoComplete="given-name" disabled={pending} /></label><label>{language === "en" ? "Last name" : "Фамилия"}<input name="lastName" autoComplete="family-name" disabled={pending} /></label><label>{language === "en" ? "Phone (optional)" : "Телефон (по желание)"}<input name="phone" type="tel" autoComplete="tel" disabled={pending} /></label></>}<label>{language === "en" ? "Email" : "Имейл"}<input name="email" type="email" autoComplete="email" placeholder="email@example.com" disabled={pending} /></label><label>{language === "en" ? "Password" : "Парола"}<input name="password" type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} minLength={authMode === "register" ? 12 : undefined} placeholder={authMode === "register" ? (language === "en" ? "At least 12 characters" : "Поне 12 символа") : (language === "en" ? "Your password" : "Вашата парола")} disabled={pending} /></label>{authMode === "register" && <label className="account-terms"><input name="acceptedTerms" type="checkbox" disabled={pending} /> <span>{language === "en" ? "I accept the terms of use." : "Приемам условията за използване."}</span></label>}{error && <p className="account-error" role="alert">{error}</p>}{notice && <p className="account-error" role="status">{notice}</p>}<button type="submit" className="button-solid" disabled={pending} aria-busy={pending}>{pending ? <><Loader2 className="animate-spin" size={18} /> {language === "en" ? "Please wait…" : "Моля, изчакайте…"}</> : authMode === "login" ? <><LogIn size={18} /> {language === "en" ? "Sign in" : "Вход в профила"}</> : <><UserPlus size={18} /> {language === "en" ? "Create profile" : "Създай профил"}</>}</button><div className="account-auth-divider">{language === "en" ? "or" : "или"}</div><button type="button" className="button-outline" disabled={!googleStatus.data?.configured || pending} onClick={() => { window.location.assign("/api/customer/google/start"); }}><Globe2 size={18} /> {googleStatus.data?.configured ? (language === "en" ? "Continue with Google" : "Продължете с Google") : (language === "en" ? "Google login unavailable" : "Входът с Google не е наличен")}</button><p className="account-help">{googleStatus.data?.configured ? (language === "en" ? "Google requests only openid, email and profile." : "Google заявява само openid, email и profile.") : (language === "en" ? "Google login is not configured yet. Use email and password." : "Входът с Google още не е конфигуриран. Използвайте имейл и парола.")} </p><button type="button" className="button-outline" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(""); }}>{authMode === "login" ? (language === "en" ? "Create a new profile" : "Създайте нов профил") : (language === "en" ? "I already have a profile" : "Вече имам профил")}</button></form></div></AccountShell>;
}

export function CustomerActivation() {
  const { language } = useLanguage();
  const [, setLocation] = useLocation();
  const search = useSearch();
  const initialToken = useMemo(() => new URLSearchParams(search).get("token") ?? "", [search]);
  const [token, setToken] = useState("");
  useEffect(() => setToken(initialToken), [initialToken]);
  const [message, setMessage] = useState("");
  const activation = trpc.customer.activate.useMutation({ onSuccess: () => { setMessage(language === "en" ? "Your password was set successfully. Signing you in…" : "Паролата е зададена успешно. Влизате в профила си…"); setTimeout(() => setLocation("/account"), 850); }, onError: (error) => setMessage(error.message || (language === "en" ? "The activation link is not valid." : "Линкът за активиране не е валиден.")) });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const password = String(form.get("password") ?? ""); const confirmation = String(form.get("confirmation") ?? ""); if (password !== confirmation) { setMessage(language === "en" ? "The two passwords do not match." : "Двете пароли не съвпадат."); return; } setMessage(""); activation.mutate({ token: token.trim(), password }); }
  return <AccountShell title={language === "en" ? "Activate your account" : "Активирайте профила си"} description={language === "en" ? "Set a new secure password for your customer account." : "Задайте нова защитена парола за своя клиентски профил."}><div className="account-activation"><section className="account-hero"><p className="eyebrow">{language === "en" ? "ACCOUNT ACTIVATION" : "АКТИВИРАНЕ НА ПРОФИЛ"}</p><h1>{language === "en" ? "Set a new password." : "Задайте нова парола."}</h1><p>{language === "en" ? "This link can be used once. Existing password details are not used after successful activation." : "Този линк е еднократен. След успешно активиране предишните данни за парола не се използват."}</p></section><form className="account-card account-login-form" onSubmit={submit}><label>{language === "en" ? "Code from the link" : "Код от линка"}<input value={token} onChange={(event) => setToken(event.target.value)} required minLength={32} maxLength={160} autoComplete="off" disabled={activation.isPending} /></label><label>{language === "en" ? "New password" : "Нова парола"}<input name="password" type="password" required minLength={12} autoComplete="new-password" placeholder={language === "en" ? "At least 12 characters" : "Поне 12 символа"} disabled={activation.isPending} /></label><label>{language === "en" ? "Repeat password" : "Повторете паролата"}<input name="confirmation" type="password" required minLength={12} autoComplete="new-password" disabled={activation.isPending} /></label>{message && <p className={activation.isSuccess ? "account-success" : "account-error"} role="status">{activation.isSuccess && <CheckCircle2 size={18} />}{message}</p>}<button type="submit" className="button-solid" disabled={activation.isPending}>{activation.isPending ? <><Loader2 className="animate-spin" size={18} /> {language === "en" ? "Activating…" : "Активиране…"}</> : <><KeyRound size={18} /> {language === "en" ? "Save new password" : "Запази новата парола"}</>}</button></form></div></AccountShell>;
}
