import { categoryTreeFor } from "./categoryHierarchy";

export type Product = {
  slug: string;
  brand?: string;
  brandLogo?: string;
  name: string;
  image: string;
  gallery: string[];
  imageAlt: string;
  price?: string;
  oldPrice?: string;
  discount?: string;
  category: string;
  availability: string;
  availabilityCode?: "in_stock" | "on_request" | "out_of_stock";
  stockQuantity?: number;
  features: string[];
  description: string;
};

const baseCategories = [
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

export const categories = baseCategories.map((category) => ({
  ...category,
  subcategories: categoryTreeFor(category.slug, [...category.subcategories]),
}));

type ProductSeed = { name: string; brand: string; price: number; features: string[]; promo?: boolean };

/** Test-only catalogue coverage: five unique browseable records for every category. */
const testCatalogue: Record<string, ProductSeed[]> = {
  instrumenti: [
    { name: "Ударна бормашина 710W", brand: "R-Max", price: 34.9, features: ["710W", "Патронник 13 мм", "Ударна функция"], promo: true },
    { name: "Акумулаторен винтоверт 18V", brand: "Workline", price: 58.5, features: ["18V", "2 батерии", "LED осветление"] },
    { name: "Ъглошлайф 125 мм", brand: "IronCore", price: 42.75, features: ["850W", "Диск 125 мм", "Защитен кожух"] },
    { name: "Лазерен нивелир 360°", brand: "ProMetric", price: 79.9, features: ["Зелен лъч", "360°", "Самонивелиране"] },
    { name: "Комплект ръчни инструменти 108 части", brand: "Workline", price: 64.2, features: ["108 части", "Cr-V стомана", "Куфар"] },
  ],
  gradina: [
    { name: "Електрически тример 1200W", brand: "GreenTask", price: 54.9, features: ["1200W", "Регулируема дръжка", "Корда 1.6 мм"], promo: true },
    { name: "Градински маркуч 20 м", brand: "AquaLine", price: 22.4, features: ["20 м", "3/4 инча", "UV защита"] },
    { name: "Комплект за поливане 5 части", brand: "AquaLine", price: 18.9, features: ["5 части", "Бързи връзки", "Регулируема струя"] },
    { name: "Градинска ножица с байпас", brand: "GreenTask", price: 14.6, features: ["Стоманено острие", "Ергономична дръжка", "До 20 мм"] },
    { name: "Сгъваем градински стол", brand: "OutdoorPro", price: 39.5, features: ["Стоманена рамка", "Сгъваем", "До 110 кг"] },
  ],
  "za-doma": [
    { name: "Конвекторен отоплител 2000W", brand: "HomeHeat", price: 88.9, features: ["2000W", "Термостат", "Защита от прегряване"], promo: true },
    { name: "Електрическа кана 1.7 л", brand: "Domus", price: 24.5, features: ["1.7 л", "2200W", "Автоматично изключване"] },
    { name: "Органайзер с 24 отделения", brand: "SortBox", price: 12.8, features: ["24 отделения", "Прозрачен капак", "Сгъваема дръжка"] },
    { name: "Прахосмукачка за сухо и мокро", brand: "CleanForce", price: 69.4, features: ["20 л", "1400W", "Мокро и сухо"] },
    { name: "Сушилник за дрехи 18 м", brand: "Domus", price: 27.3, features: ["18 м", "Стоманена рамка", "Сгъваем"] },
  ],
  banya: [
    { name: "Смесител за мивка хром", brand: "AquaForm", price: 47.6, features: ["Керамична глава", "Хром", "Гъвкави връзки"], promo: true },
    { name: "Душ слушалка с 3 функции", brand: "AquaForm", price: 18.4, features: ["3 струи", "Антиваровик", "Универсална резба"] },
    { name: "Шкаф за баня 60 см", brand: "BathLine", price: 129.9, features: ["60 см", "Влагоустойчив", "Soft-close"] },
    { name: "Огледало с LED осветление", brand: "BathLine", price: 98.5, features: ["60 × 80 см", "LED", "IP44"] },
    { name: "Сифон за мивка с клапа", brand: "PipeMate", price: 11.7, features: ["1 1/4", "Хромирана клапа", "Регулируем"] },
  ],
  osvetlenie: [
    { name: "LED панел 18W кръгъл", brand: "LumenPro", price: 13.9, features: ["18W", "4000K", "Вграден драйвер"], promo: true },
    { name: "LED крушка E27 10W", brand: "LumenPro", price: 3.8, features: ["10W", "806 lm", "3000K"] },
    { name: "Двоен контакт със заземяване", brand: "Electra", price: 6.9, features: ["16A", "Заземяване", "Бял"] },
    { name: "Кабел ШВПС 3 × 1.5 мм 10 м", brand: "Cablex", price: 19.6, features: ["10 м", "3 × 1.5 мм", "Медни жила"] },
    { name: "Автоматичен предпазител C16", brand: "Electra", price: 7.4, features: ["C16", "1P", "6kA"] },
  ],
  "podovi-i-stenni-pokritiya": [
    { name: "Гранитогрес 60 × 60 см", brand: "SurfaceLab", price: 18.9, features: ["60 × 60 см", "Матиран", "PEI IV"], promo: true },
    { name: "Ламинат AC4 дъб натурал", brand: "FloorCraft", price: 16.7, features: ["AC4", "8 мм", "Клик система"] },
    { name: "Лепило за плочки 25 кг", brand: "TileBond", price: 9.8, features: ["25 кг", "C2TE", "За вътрешно"] },
    { name: "Фугираща смес 2 кг", brand: "TileBond", price: 6.2, features: ["2 кг", "Водоустойчива", "Сива"] },
    { name: "PVC перваз 2.5 м", brand: "FloorCraft", price: 4.6, features: ["2.5 м", "PVC", "Кабелен канал"] },
  ],
  "v-i-k": [
    { name: "PP-R тръба 20 мм 4 м", brand: "PipeMate", price: 8.9, features: ["20 мм", "4 м", "PP-R"], promo: true },
    { name: "Месингов сферичен кран 1/2", brand: "ValvePro", price: 7.6, features: ["1/2", "Месинг", "Пълнопроходен"] },
    { name: "Гъвкава връзка 50 см", brand: "PipeMate", price: 4.2, features: ["50 см", "1/2", "Неръждаема оплетка"] },
    { name: "Сифон за под ф50", brand: "DrainLine", price: 12.5, features: ["Ф50", "Нисък профил", "Решетка инокс"] },
    { name: "Фитинг коляно 90° 20 мм", brand: "PipeMate", price: 2.8, features: ["20 мм", "90°", "PP-R"] },
  ],
  "vrati-obkov-krepezhi": [
    { name: "Интериорна врата дъб 80 см", brand: "DoorLine", price: 159.9, features: ["80 см", "MDF", "Каса включена"], promo: true },
    { name: "Комплект дръжки за врата", brand: "LockCraft", price: 24.6, features: ["Алуминий", "Розетка", "Крепежи"] },
    { name: "Панта с лагер 100 мм", brand: "LockCraft", price: 5.3, features: ["100 мм", "С лагер", "Стомана"] },
    { name: "Дюбел с винт 8 × 60", brand: "FixPoint", price: 6.8, features: ["50 броя", "8 × 60", "Найлон"] },
    { name: "Патрон за брава 30/30", brand: "DoorLine", price: 18.7, features: ["30/30", "3 ключа", "Месинг"] },
  ],
  "boi-lakove-mazilki": [
    { name: "Интериорен латекс 5 л", brand: "ColorGrid", price: 22.9, features: ["5 л", "Мат", "Покривност 12 м²/л"], promo: true },
    { name: "Фасадна боя 10 л", brand: "ColorGrid", price: 44.8, features: ["10 л", "Силиконова", "UV защита"] },
    { name: "Декоративна мазилка 25 кг", brand: "PlasterPro", price: 28.6, features: ["25 кг", "Минерална", "1.5 мм"] },
    { name: "Комплект четки 3 броя", brand: "PaintFlow", price: 9.5, features: ["3 броя", "Естествен косъм", "Дървена дръжка"] },
    { name: "Валяк микрофибър 25 см", brand: "PaintFlow", price: 7.8, features: ["25 см", "Микрофибър", "За латекс"] },
  ],
  stroitelstvo: [
    { name: "Цимент 25 кг", brand: "BuildCore", price: 6.9, features: ["25 кг", "CEM II", "За зидария"], promo: true },
    { name: "Газобетонен блок 60 × 25 × 10", brand: "BlockPro", price: 4.5, features: ["60 × 25 × 10", "Газобетон", "Топлоизолация"] },
    { name: "XPS изолация 5 см", brand: "ThermoGrid", price: 11.8, features: ["5 см", "XPS", "125 kPa"] },
    { name: "Лепило за топлоизолация 25 кг", brand: "BuildCore", price: 10.6, features: ["25 кг", "За EPS/XPS", "Сиво"] },
    { name: "Бетонова смес 25 кг", brand: "BuildCore", price: 7.7, features: ["25 кг", "Бързосвързваща", "За дребни ремонти"] },
  ],
  "rabotno-obleklo": [
    { name: "Работни обувки S3", brand: "SafeStep", price: 48.9, features: ["S3", "Стоманено бомбе", "Антистатични"], promo: true },
    { name: "Защитни ръкавици нитрил", brand: "GuardPro", price: 6.4, features: ["Нитрил", "Размер L", "EN388"] },
    { name: "Предпазна каска", brand: "GuardPro", price: 13.5, features: ["EN397", "Регулируема", "Вентилация"] },
    { name: "Защитни очила прозрачни", brand: "SafeStep", price: 8.2, features: ["EN166", "Антифог", "UV защита"] },
    { name: "Работно яке с висока видимост", brand: "WorkShield", price: 36.7, features: ["Размер L", "Светлоотразително", "Водоотблъскващо"] },
  ],
};

const sourceCatalogueNames: Record<string, string[]> = {
  instrumenti: ["Дръжка за градински инструменти клик система PREMIUM", "Дръжка за градински инструменти телескопична клик", "Инструмент за монтаж анкер гипс", "Калъф за инструменти за 11елемента TOPEX", "Калъф за инструменти за 8елемента ТОРЕХ"], gradina: ["Bio Plantella Градина течен органичен тор 1 л.", "Микс Японска цветна градина 1374", "Соларна лампа LED за градина, SS-6033S, с бутон", "Соларна лампа за градина - метал с променящи се цветове", "Соларна лампа за градина 10LED SS-6022 комплект"], "za-doma": ["Д-р ФРЕШ СТИЛ електроуреди син", "Диск за уред за заточване на вериги PREMIUM", "Уред за заточване на вериги 220W PREMIUM", "Уред за почистване на прозорци BOSCH", "Уред за почистване на прозорци WV2 -Керхер"], banya: ["ВИДИМА СТОЯЩ СМЕСИТЕЛ ORION В0880АА", "ВИДИМА СТОЯЩ СМЕСИТЕЛ ЗА КУХНЯ ORION В0881АА", "Комплект смесители за баня ROCA ESMAI 3в1", "Кухненски смесител с електрически водонагревател Cascada DO-14-3C", "Кухненски смесител с електрически водонагревател DO-8-3C, стоящ с дисплей"], osvetlenie: ["Газ за осветление", "Надуваема мебел с вградено LED осветление 68695", "Надуваема табуретка Intex с вградено LED осветление", "Чадър градински с LED-осветление UMB-006B светлозелен", "Соларна лампа за градина 10LED SS-6022 комплект"], "podovi-i-stenni-pokritiya": ["ГРАНИТОГРЕС 60Х120 MURATTO BEIGE - МАТ", "ГРАНИТОГРЕС 60Х120 POLASKI MUD - МАТ", "ГРАНИТОГРЕС AMADIO BROWN 15/60 10БР.", "ГРАНИТОГРЕС MARBELLA WHITE ПОЛИРАН - 60Х120", "ГРАНИТОГРЕС MOONSTON КАФЯВ 90551"], "v-i-k": ["Луминесцентна тръба 15W VIVA LUX", "Профилна тръба 10Х10Х1,5", "Профилна тръба 15Х15Х1,5", "Профилна тръба 20Х10Х1,5", "Профилна тръба 20Х20Х1,5"], "vrati-obkov-krepezhi": ["Автомат за врата E 602/20-45кг", "Автомат за врата E 603 / 60-85кг", "Блиндирана входна врата 141-5 Y", "Блиндирана входна врата 666", "Блиндирана входна врата 888"], "boi-lakove-mazilki": ["Акрилатна боя за пчелни кошери Марсел Жълта", "Акрилатна боя за пчелни кошери Марсел Зелена", "Акрилатна боя за пчелни кошери Марсел Синя", "Акрилатна боя за пчелни кошери Марсел - Оранжева", "Акрилатна боя за пчелни кошери Марсел - Светложълта"], stroitelstvo: ["БАУМИТ БЕТОН 25КГ", "БАУМИТ БЕТОНКОНТАКТ 1КГ", "БАУМИТ БЕТОНКОНТАКТ 5КГ.", "БЕТОНОБЪРКАЧКА 150Л. 850W 26.6ОБ./МИН.", "БЕТОНОБЪРКАЧКА 180Л. 1000W 26.6ОБ./МИН."], "rabotno-obleklo": ["Д-р ФРЕШ Ръкавици L", "Д-р ФРЕШ Ръкавици S", "Д-р ФРЕШ Ръкавици XL", "Домакински ръкавици ароматизирани L", "Домакински ръкавици ароматизирани M"],
};
const sourceCatalogueBrands: Record<string, string[]> = { instrumenti: ["PREMIUM", "PREMIUM", "ЖОАН", "TOPEX", "ТОРЕХ"], gradina: ["Bio Plantella", "ЖОАН", "ЖОАН", "ЖОАН", "ЖОАН"], "za-doma": ["Д-р ФРЕШ", "PREMIUM", "PREMIUM", "BOSCH", "Kärcher"], banya: ["VIDIMA", "VIDIMA", "ROCA", "Cascada", "Cascada"], osvetlenie: ["ЖОАН", "INTEX", "INTEX", "ЖОАН", "ЖОАН"], "podovi-i-stenni-pokritiya": ["Ceramica Fiore", "Ceramica Fiore", "Ceramica Fiore", "Ceramica Fiore", "Ceramica Fiore"], "v-i-k": ["VIVA LUX", "ЖОАН", "ЖОАН", "ЖОАН", "ЖОАН"], "vrati-obkov-krepezhi": ["ЖОАН", "ЖОАН", "ЖОАН", "ЖОАН", "ЖОАН"], "boi-lakove-mazilki": ["Марсел", "Марсел", "Марсел", "Марсел", "Марсел"], stroitelstvo: ["Baumit", "Baumit", "Baumit", "ЖОАН", "ЖОАН"], "rabotno-obleklo": ["Д-р ФРЕШ", "Д-р ФРЕШ", "Д-р ФРЕШ", "ЖОАН", "ЖОАН"] };

const allRealProductImages = [
  "/manus-storage/joan-live-product-01_505f4e7c.png", "/manus-storage/joan-live-product-02_c4544878.jpg", "/manus-storage/joan-live-product-03_9de366f7.jpg", "/manus-storage/joan-live-product-04_b9cdda3f.jpg", "/manus-storage/joan-live-product-05_fa528c49.jpg",
  "/manus-storage/joan-live-product-06_2c4818fb.jpg", "/manus-storage/joan-live-product-07_89309785.png", "/manus-storage/joan-live-product-08_2a639a00.jpg", "/manus-storage/joan-live-product-09_4804982a.jpg", "/manus-storage/joan-live-product-10_a76b9d57.jpg",
  "/manus-storage/joan-live-product-11_8baaa47e.png", "/manus-storage/joan-live-product-12_9ab66b5f.jpg", "/manus-storage/joan-live-product-13_9916b902.jpg", "/manus-storage/joan-live-product-14_b8c03210.jpg", "/manus-storage/joan-live-product-15_f52dd44c.jpg",
  "/manus-storage/joan-live-product-16_a264738d.jpg", "/manus-storage/joan-live-product-17_e81a56f6.jpg", "/manus-storage/joan-live-product-18_3e165e54.jpg", "/manus-storage/joan-live-product-19_4a669581.jpg", "/manus-storage/joan-live-product-20_3dd00658.jpg",
  "/manus-storage/joan-live-product-21_cc9d556a.jpg", "/manus-storage/joan-live-product-22_5d8940d9.jpg", "/manus-storage/joan-live-product-23_1d8d0fd0.jpg", "/manus-storage/joan-live-product-24_d01a8287.jpg", "/manus-storage/joan-live-product-25_19475ad3.jpg",
  "/manus-storage/joan-live-product-26_8db946b9.jpg", "/manus-storage/joan-live-product-27_df59a173.jpg", "/manus-storage/joan-live-product-28_38901fc5.jpg", "/manus-storage/joan-live-product-29_9b58ae8e.jpg", "/manus-storage/joan-live-product-30_cf749f9c.jpg",
  "/manus-storage/joan-live-product-31_5c892fa1.jpg", "/manus-storage/joan-live-product-32_c989b9c7.jpg", "/manus-storage/joan-live-product-33_3dc466ee.jpg", "/manus-storage/joan-live-product-34_a5397eef.jpg", "/manus-storage/joan-live-product-35_035c07ea.jpg",
  "/manus-storage/joan-live-product-36_28b006a9.jpg", "/manus-storage/joan-live-product-37_aabf7190.jpg", "/manus-storage/joan-live-product-38_243eecbd.jpg", "/manus-storage/joan-live-product-39_50cf756a.jpg", "/manus-storage/joan-live-product-40_6e68967a.jpg",
  "/manus-storage/joan-live-product-41_0d9a8a5e.png", "/manus-storage/joan-live-product-42_e8f1ca77.jpg", "/manus-storage/joan-live-product-43_88fdcbeb.jpg", "/manus-storage/joan-live-product-44_b2f26140.jpg", "/manus-storage/joan-live-product-45_6cf1d556.jpg",
  "/manus-storage/joan-live-product-46_7c6d3667.jpg", "/manus-storage/joan-live-product-47_28e31768.png", "/manus-storage/joan-live-product-48_86dd7392.png", "/manus-storage/joan-live-product-49_6cbacc2d.png", "/manus-storage/joan-live-product-50_a169a3e3.jpg",
  "/manus-storage/joan-live-product-51_26775ce2.png", "/manus-storage/joan-live-product-52_a4f9103d.jpg", "/manus-storage/joan-live-product-53_fcd9c7ab.jpg", "/manus-storage/joan-live-product-54_545775fc.jpg", "/manus-storage/joan-live-product-55_76a21ec4.png",
] as const;

const realProductImages = [
  16, 17, 18, 19, 23, 35, 36, 37, 40, 41, 6, 7, 8, 45, 47, 46, 47, 48, 49, 50, 37, 38, 39, 40, 41,
  4, 5, 10, 11, 12, 26, 27, 28, 29, 30, 16, 17, 19, 20, 21, 10, 11, 12, 13, 14, 4, 5, 4, 9, 31,
  19, 20, 21, 22, 24,
].map((imageNumber) => allRealProductImages[imageNumber - 1]);

function createTestProduct(category: (typeof categories)[number], seed: ProductSeed, index: number, imageIndex: number): Product {
  const oldPrice = seed.promo ? seed.price * 1.14 : undefined;
  const image = realProductImages[imageIndex] ?? category.image;
  const name = sourceCatalogueNames[category.slug]?.[index] ?? seed.name;
  const brand = sourceCatalogueBrands[category.slug]?.[index] ?? seed.brand;
  return {
    slug: `${category.slug}-test-${index + 1}`,
    brand,
    name,
    image,
    gallery: [image, category.image],
    imageAlt: `${name} — продуктова снимка от Жоан`,
    price: `${seed.price.toFixed(2)}€`,
    oldPrice: oldPrice ? `${oldPrice.toFixed(2)}€` : undefined,
    discount: seed.promo ? "-12%" : undefined,
    category: category.slug,
    availability: index % 2 === 0 ? "На склад" : "По запитване",
    features: ["Оригинален каталожен артикул", "Наличност по потвърждение", "Информация от Жоан"],
    description: `${name} е артикул от оригиналния каталог на Жоан. Цената и наличността в тази тестова версия се потвърждават от екипа на магазина.`,
  };
}

export const products: Product[] = categories.flatMap((category, categoryIndex) => (testCatalogue[category.slug] ?? []).map((seed, index) => createTestProduct(category, seed, index, categoryIndex * 5 + index)));

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
