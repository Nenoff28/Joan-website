import { JsonLd, Layout, PageMeta } from "@/components/Storefront";
import { trpc } from "@/lib/trpc";
import { CheckCircle2, KeyRound, Loader2, LogIn, LogOut, MapPin, ShieldCheck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

function AccountShell({ children, title, description }: { children: React.ReactNode; title: string; description: string }) {
  return <Layout><PageMeta title={title} description={description} /><JsonLd /><main className="account-page"><section className="page-frame account-frame">{children}</section></main></Layout>;
}

export default function CustomerAccount() {
  const [location, setLocation] = useLocation();
  const account = trpc.customer.me.useQuery();
  const login = trpc.customer.login.useMutation({
    onSuccess: async () => { await account.refetch(); toast.success("Влязохте успешно в профила си."); },
    onError: (error) => toast.error(error.message || "Входът не е успешен. Проверете данните си."),
  });
  const logout = trpc.customer.logout.useMutation({ onSuccess: async () => { await account.refetch(); toast.success("Излязохте от профила си."); setLocation("/"); } });
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!email || !password) { setError("Попълнете имейл и парола."); return; }
    setError("");
    login.mutate({ email, password });
  }

  if (account.isLoading) return <AccountShell title="Профил" description="Вход в клиентски профил на Жоан."><div className="account-loading"><Loader2 className="animate-spin" size={24} /> Зареждане на профил…</div></AccountShell>;
  if (account.data) {
    const profile = account.data;
    return <AccountShell title="Моят профил" description="Преглед на клиентския профил, запазените адреси и наличната историческа информация.">
      <div className="account-hero"><p className="eyebrow">КЛИЕНТСКИ ПРОФИЛ</p><h1>Здравейте, {profile.firstName}.</h1><p>Вашият профил и запазените адреси са готови за използване.</p></div>
      <section className="account-card account-profile-card"><div><span className="account-icon"><ShieldCheck size={22} /></span><div><p className="eyebrow">ДАННИ ЗА ПРОФИЛА</p><h2>{profile.firstName} {profile.lastName}</h2><a href={`mailto:${profile.email}`}>{profile.email}</a>{profile.phone && <p>{profile.phone}</p>}</div></div><button type="button" className="button-outline" disabled={logout.isPending} onClick={() => logout.mutate()}><LogOut size={17} /> Изход</button></section>
      <section className="account-address-section"><div><p className="eyebrow">ЗАПАЗЕНИ АДРЕСИ</p><h2>Адреси за доставка</h2></div>{profile.addresses.length ? <div className="account-address-grid">{profile.addresses.map((address) => <article key={address.id} className="account-address-card"><MapPin size={20} /><div><b>{address.firstName} {address.lastName}</b>{address.company && <span>{address.company}</span>}<span>{address.addressLine1}</span>{address.addressLine2 && <span>{address.addressLine2}</span>}<span>{address.postcode ? `${address.postcode} ` : ""}{address.city}</span>{address.zone && <span>{address.zone}</span>}{address.country && <span>{address.country}</span>}{address.isDefault && <small>Основен адрес</small>}</div></article>)}</div> : <p className="account-empty">Към профила все още няма запазен адрес.</p>}</section>
      <section className="account-history-section"><div><p className="eyebrow">ИСТОРИЧЕСКИ ПОРЪЧКИ</p><h2>Предишни заявки</h2><p>Показват се единствено поръчки от стария сайт, които са свързани с този клиентски профил.</p></div>{profile.historicalOrders.length ? <div className="account-history-list">{profile.historicalOrders.map((order) => <details key={order.legacyOrderId} className="account-history-order"><summary><span><b>Поръчка №{order.legacyOrderId}</b><small>{new Date(order.orderedAt).toLocaleDateString("bg-BG", { dateStyle: "medium" })}</small></span><span><em>{order.orderStatus}</em><strong>{Number(order.totalInOrderCurrency ?? order.total).toFixed(2)} {order.currencyCode}</strong></span></summary><div>{order.lines.map((line, index) => <p key={`${line.productName}-${index}`}><span>{line.productName}{line.productModel ? ` · ${line.productModel}` : ""} × {line.quantity}</span><b>{Number(line.lineTotal).toFixed(2)} {order.currencyCode}</b></p>)}</div></details>)}</div> : <p className="account-empty">Няма исторически поръчки, свързани с този профил.</p>}</section>
    </AccountShell>;
  }

  return <AccountShell title="Вход" description="Вход за клиентски профил на Жоан."><div className="account-auth-grid"><section className="account-hero"><p className="eyebrow">КЛИЕНТСКИ ПРОФИЛ</p><h1>Влезте в своя профил.</h1><p>Прегледайте запазените си адреси и използвайте профила си при бъдещи поръчки.</p><div className="account-note"><KeyRound size={20} /><span><b>Първо влизане след прехвърлянето?</b> Ще получите защитен линк, с който да зададете нова парола за вече съществуващия си профил.</span></div></section><form className="account-card account-login-form" onSubmit={submit} noValidate><div><p className="eyebrow">ВХОД</p><h2>Добре дошли отново</h2></div><label>Имейл<input name="email" type="email" autoComplete="email" placeholder="email@primer.bg" disabled={login.isPending} /></label><label>Парола<input name="password" type="password" autoComplete="current-password" placeholder="Вашата парола" disabled={login.isPending} /></label>{error && <p className="account-error" role="alert">{error}</p>}<button type="submit" className="button-solid" disabled={login.isPending} aria-busy={login.isPending}>{login.isPending ? <><Loader2 className="animate-spin" size={18} /> Проверка…</> : <><LogIn size={18} /> Вход в профила</>}</button><p className="account-help">Ако профилът ви е прехвърлен от стария сайт, използвайте линка за първо активиране, изпратен на имейла ви. Нужда от помощ? <Link href="/contact">Свържете се с нас</Link>.</p></form></div></AccountShell>;
}

export function CustomerActivation() {
  const [, setLocation] = useLocation();
  const initialToken = useMemo(() => new URLSearchParams(window.location.search).get("token") ?? "", []);
  const [token, setToken] = useState(initialToken);
  const [message, setMessage] = useState("");
  const activation = trpc.customer.activate.useMutation({ onSuccess: () => { setMessage("Паролата е зададена успешно. Влизате в профила си…"); window.setTimeout(() => setLocation("/account"), 850); }, onError: (error) => setMessage(error.message || "Линкът за активиране не е валиден.") });
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); const password = String(form.get("password") ?? ""); const confirmation = String(form.get("confirmation") ?? ""); if (password !== confirmation) { setMessage("Двете пароли не съвпадат."); return; } setMessage(""); activation.mutate({ token: token.trim(), password }); }
  return <AccountShell title="Активирайте профила си" description="Задайте нова защитена парола за своя клиентски профил."><div className="account-activation"><section className="account-hero"><p className="eyebrow">АКТИВИРАНЕ НА ПРОФИЛ</p><h1>Задайте нова парола.</h1><p>Този линк е еднократен. След успешно активиране старите данни за парола не се използват.</p></section><form className="account-card account-login-form" onSubmit={submit}><label>Код от линка<input value={token} onChange={(event) => setToken(event.target.value)} required minLength={32} maxLength={160} autoComplete="off" disabled={activation.isPending} /></label><label>Нова парола<input name="password" type="password" required minLength={12} autoComplete="new-password" placeholder="Поне 12 символа" disabled={activation.isPending} /></label><label>Повторете паролата<input name="confirmation" type="password" required minLength={12} autoComplete="new-password" disabled={activation.isPending} /></label>{message && <p className={activation.isSuccess ? "account-success" : "account-error"} role="status">{activation.isSuccess && <CheckCircle2 size={18} />}{message}</p>}<button type="submit" className="button-solid" disabled={activation.isPending}>{activation.isPending ? <><Loader2 className="animate-spin" size={18} /> Активиране…</> : <><KeyRound size={18} /> Запази новата парола</>}</button></form></div></AccountShell>;
}
