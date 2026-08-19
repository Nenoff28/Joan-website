export type Product = {
  slug: string;
  brand?: string;
  name: string;
  image: string;
  imageAlt: string;
  price?: string;
  priceBgn?: string;
  oldPrice?: string;
  oldPriceBgn?: string;
  discount?: string;
  category: string;
  availability: string;
  features: string[];
  description: string;
};

export const categories = [
  {
    slug: "instrumenti",
    label: "Инструменти",
    description: "Професионални и хоби инструменти за всяка задача.",
    image: "/manus-storage/joan-tools-workshop_2fd2b25d.jpg",
    icon: "drill",
    subcategories: ["Електроинструменти", "Ръчни инструменти", "Измервателни инструменти", "Заваръчна техника"],
  },
  {
    slug: "gradina",
    label: "Градина",
    description: "Техника, поливане и решения за външното пространство.",
    image: "/manus-storage/joan-garden-materials_4dda013b.jpg",
    icon: "trees",
    subcategories: ["Градинска техника", "Поливане", "Басейни", "Градински мебели"],
  },
  {
    slug: "za-doma",
    label: "За Дома",
    description: "Практични продукти за поддръжка и комфорт у дома.",
    image: "/manus-storage/joan-bathroom-surfaces_073c9a61.jpg",
    icon: "house",
    subcategories: ["Отопление", "Уреди", "Организация", "Почистване"],
  },
  {
    slug: "banya",
    label: "Баня",
    description: "Санитарни решения, мебели и полезни аксесоари.",
    image: "/manus-storage/joan-bathroom-surfaces_073c9a61.jpg",
    icon: "bath",
    subcategories: ["Смесители", "Мебели за баня", "Душове", "Аксесоари"],
  },
  {
    slug: "osvetlenie",
    label: "Осветление и ел.материали",
    description: "Осветление, електроапаратура и материали.",
    image: "/manus-storage/joan-lighting-electrical_530229da.jpg",
    icon: "lamp",
    subcategories: ["Осветителни тела", "Кабели", "Ключове и контакти", "Електроапаратура"],
  },
  {
    slug: "podovi-i-stenni-pokritiya",
    label: "Подови и стенни покрития",
    description: "Повърхности и материали за завършен интериор.",
    image: "/manus-storage/joan-floor-wall-surfaces_a5ee519f.jpg",
    icon: "panels-top-left",
    subcategories: ["Плочки", "Ламинат", "Лепила", "Фугиращи смеси"],
  },
  {
    slug: "v-i-k",
    label: "В и К",
    description: "Части, аксесоари и решения за ВиК инсталации.",
    image: "/manus-storage/joan-plumbing-materials_0b8b32d3.jpg",
    icon: "waves",
    subcategories: ["Тръби и фитинги", "Сифони", "Кранове", "Помпи"],
  },
  {
    slug: "vrati-obkov-krepezhi",
    label: "Врати, Обков, Крепежи",
    description: "Сигурност, свързване и довършителни детайли.",
    image: "/manus-storage/joan-doors-fittings-fasteners_7b8c2d09.jpg",
    icon: "lock-keyhole",
    subcategories: ["Врати", "Обков", "Крепежни елементи", "Заключващи системи"],
  },
  {
    slug: "boi-lakove-mazilki",
    label: "Бои, Лакове, Мазилки",
    description: "Подготовка, защита и завършек на всяка повърхност.",
    image: "/manus-storage/joan-paint-plaster-materials_fec7fc02.jpg",
    icon: "paint-roller",
    subcategories: ["Интериорни бои", "Лакове", "Мазилки", "Инструменти за боядисване"],
  },
  {
    slug: "stroitelstvo",
    label: "Строителство",
    description: "Основни материали за обекти, ремонти и конструкция.",
    image: "/manus-storage/joan-construction-materials_5b21e335.jpg",
    icon: "brick-wall",
    subcategories: ["Цимент и бетон", "Строителна химия", "Изолация", "Абразиви"],
  },
  {
    slug: "rabotno-obleklo",
    label: "Работно облекло",
    description: "Предпазни средства и облекло за работа.",
    image: "/manus-storage/joan-workwear-safety_e03a02e7.jpg",
    icon: "hard-hat",
    subcategories: ["Работни обувки", "Ръкавици", "Защита на главата", "Работно облекло"],
  },
] as const;

export const products: Product[] = [
  {
    slug: "rtrmax-bormashina-udarna-710w-13mm-x-lion",
    brand: "RTRMAX",
    name: "Бормашина ударна 710W 13мм X-LION",
    image: "/manus-storage/joan-rtrmax-drill_0666e8cc.webp",
    imageAlt: "RTRMAX Бормашина ударна 710W 13мм X-LION",
    price: "34.90€",
    priceBgn: "68.26 лв",
    oldPrice: "42.33€",
    oldPriceBgn: "82.79 лв",
    discount: "-18%",
    category: "instrumenti",
    availability: "Попитайте за наличност",
    features: ["710W", "Патронник 13 мм", "Ударна функция"],
    description: "Представителен продукт от текущите промоции на Joan. Пълните технически данни и актуалната наличност се потвърждават при запитване.",
  },
  {
    slug: "casa-bella-boya-saten-650ml-bejeva",
    brand: "Casa Bella",
    name: "Боя Каса Бела сатен 650 мл бежева",
    image: "/manus-storage/joan-casa-bella-paint_5d0aa89b.webp",
    imageAlt: "Casa Bella Боя Каса Бела сатен 650 мл бежева",
    category: "boi-lakove-mazilki",
    availability: "Попитайте за наличност",
    features: ["Сатенен финиш", "650 мл", "Бежев цвят"],
    description: "Представителна боя Casa Bella от видимите текущи предложения на Joan. Изпратете запитване за актуална цена и наличност.",
  },
  {
    slug: "baumit-beton-25kg",
    brand: "Baumit",
    name: "Баумит бетон 25кг",
    image: "/manus-storage/joan-baumit-beton_20236779.webp",
    imageAlt: "Baumit бетон 25 кг",
    category: "stroitelstvo",
    availability: "Попитайте за наличност",
    features: ["25 кг", "Бетонова смес", "Строителни материали"],
    description: "Представителен продукт Baumit от текущия Joan каталог. Подробности за приложение и наличност се потвърждават от екипа на магазина.",
  },
  {
    slug: "tesy-boyler-100l-gcv1004430-b12-tsr",
    brand: "TESY",
    name: "Бойлер Tesy 100л GCV1004430 B12 TSR",
    image: "/manus-storage/joan-tesy-boiler_299208a4.webp",
    imageAlt: "TESY Бойлер 100 л GCV1004430 B12 TSR",
    category: "za-doma",
    availability: "Попитайте за наличност",
    features: ["100 л", "TESY", "За дома"],
    description: "Представителен бойлер TESY от текущия Joan каталог. За точни технически параметри и доставка, изпратете запитване.",
  },
];

export const store = {
  name: "ЖОАН",
  address: "гр. Силистра, ул. Тутракан №22",
  city: "Силистра",
  email: "info@joan.bg",
  phones: ["(086) 821 362", "(086) 821 021", "(0884) 742 770", "(0888) 690 767"],
  hours: [
    ["Понеделник – Петък", "08:00 – 19:00"],
    ["Събота", "08:00 – 18:00"],
    ["Неделя", "08:00 – 17:00"],
  ],
};
