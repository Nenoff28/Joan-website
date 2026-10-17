/** Delivery information with complete Bulgarian and English customer-facing copy. */
import { Layout, PageMeta } from "@/components/Storefront";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  PackageCheck,
  PhoneCall,
  Truck,
} from "lucide-react";
import { Link } from "wouter";

export default function Delivery() {
  const { language } = useLanguage();
  const en = language === "en";
  return (
    <Layout>
      <PageMeta
        title={en ? "Delivery terms" : "Условия за доставка"}
        description={
          en
            ? "Our delivery terms: dispatch after operator confirmation and published weekday and Saturday timeframes."
            : "Нашите условия за доставка: изпращане след потвърждение от оператор и срокове за работни дни и събота."
        }
      />
      <main className="delivery-page">
        <section className="delivery-hero">
          <div className="page-frame">
            <p className="eyebrow">
              {en ? "Customer information" : "Клиентска информация"}
            </p>
            <h1>{en ? "Delivery terms" : "Условия за доставка"}</h1>
            <p>
              {en
                ? "We have arranged our delivery information for quick reference before an enquiry or order."
                : "Подредили сме информацията за доставката, за да се ориентирате бързо преди запитване или поръчка."}
            </p>
          </div>
        </section>
        <section className="page-frame delivery-intro">
          <div className="delivery-statement">
            <Truck size={30} />
            <div>
              <p className="eyebrow">
                {en
                  ? "How we organise delivery"
                  : "Как организираме доставката"}
              </p>
              <h2>
                {en
                  ? "Every delivery from the online store is express."
                  : "Всяка доставка от онлайн магазина е експресна."}
              </h2>
              <p>
                {en
                  ? "After an operator confirms the request, the order is packed and dispatched at the customer’s expense."
                  : "След потвърждение от оператор поръчката се опакова и изпраща за сметка на клиента."}
              </p>
            </div>
          </div>
          <div className="delivery-contact">
            <PhoneCall size={20} />
            <span>
              {en
                ? "To confirm delivery and availability:"
                : "За уточняване на доставка и наличност:"}{" "}
              <b>(0884) 742 770</b>
            </span>
          </div>
        </section>
        <section className="page-frame delivery-timeline">
          <div className="timeline-card">
            <CalendarClock />
            <h3>{en ? "Weekday until 16:00" : "Делничен ден до 16:00"}</h3>
            <p>
              {en
                ? "When you place an order by 16:00 on a working day, we pack and dispatch it the same day for delivery the next day."
                : "Когато направите поръчка до 16:00 в работен ден, я опаковаме и изпращаме същия ден, за да я получите на следващия ден."}
            </p>
          </div>
          <div className="timeline-card">
            <PackageCheck />
            <h3>{en ? "Weekday after 16:00" : "Делничен ден след 16:00"}</h3>
            <p>
              {en
                ? "For an order placed after 16:00, we dispatch on the next working day and you receive it on the second day after the order date."
                : "При поръчка след 16:00 изпращаме през следващия работен ден и получавате стоката на втория ден от датата на поръчката."}
            </p>
          </div>
          <div className="timeline-card">
            <CalendarClock />
            <h3>{en ? "Saturday until 12:00" : "Събота до 12:00"}</h3>
            <p>
              {en
                ? "For an order placed on Saturday by 12:00, we dispatch it the same day for Monday delivery. After 12:00, we dispatch on Monday for Tuesday delivery."
                : "При поръчка в събота до 12:00 изпращаме същия ден и получавате стоката в понеделник. След 12:00 изпращаме в понеделник и получавате стоката във вторник."}
            </p>
          </div>
        </section>
        <section className="page-frame exception-panel">
          <div>
            <AlertTriangle size={24} />
            <h2>{en ? "Possible exceptions" : "Възможни изключения"}</h2>
          </div>
          <p>
            {en
              ? "Please note that timeframes can be affected by limited access to an address or settlement, out-of-stock items, force majeure or a natural disaster."
              : "Моля, имайте предвид, че сроковете могат да се променят при ограничен достъп до адрес или населено място, изчерпана наличност, форсмажорни обстоятелства или природно бедствие."}
          </p>
          <Link href="/contact">
            {en
              ? "Do you have a specific question?"
              : "Имате конкретен въпрос?"}{" "}
            <ArrowRight size={17} />
          </Link>
        </section>
      </main>
    </Layout>
  );
}
