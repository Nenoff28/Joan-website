# Карта с офиси на Спиди и Еконт — план за изпълнение

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** В поръчката клиентът избира офис на Спиди или Еконт от една карта и вижда ориентировъчна цена от куриера.

**Architecture:** Сървърът говори с API на куриерите (пароли само в `.env`), кешира офисите 24 ч и цените 15 мин, и ги дава през tRPC `shipping.offices` / `shipping.quote`. Клиентът зарежда Leaflet лениво само при избор „До офис на куриер“. Избраният офис се записва в адресните полета на заявката — без миграция.

**Tech Stack:** Express + tRPC 11, React 19, Vitest, `leaflet` + `leaflet.markercluster` (нови), OpenStreetMap тайлове.

**Spec:** `docs/superpowers/specs/2026-11-18-courier-office-map-design.md`

## Global Constraints

- Цена само от API на куриера; при грешка: `null` → текст „Цената ще бъде потвърдена от оператор.“ Никога число от нас.
- Пароли само от `process.env`: `ECONT_API_URL`, `ECONT_USERNAME`, `ECONT_PASSWORD`, `SPEEDY_USERNAME`, `SPEEDY_PASSWORD`, `SHIPPING_DEFAULT_WEIGHT_KG` (по подразбиране 2). Куриер без потребител/парола не се показва.
- Подател: ЖОАН, гр. Силистра 7500. Спиди услуга 505. Еконт `shipmentType: "PACK"`, `countryCode: "BGR"`.
- Без миграции; без промени в админ кода.
- CSP: добави `https://*.tile.openstreetmap.org` в `img-src`.
- Тест среда Еконт: `ECONT_API_URL=https://demo.econt.com/ee/services`, публичен потребител `iasp-dev` (само локално).

## Review Focus

1. Офис без координати → само в списъка, без маркер; картата не гърми.
2. API на куриера бави/пада → `shipping.offices` връща празен списък за него, другият куриер работи; `quote` → `null`.
3. Множество бързи кликове по офиси → лимит 30 цени/мин на IP; над него `quote` връща грешка с ясен текст, формата не се чупи.
4. Клиент сменя куриер/офис след избор → старата цена изчезва, докато новата не дойде.
5. Изпращане без избран офис → „Изберете офис на куриер.“, без заявка към сървъра.

---

### Task 1: Еконт адаптер

**Files:** Create `server/couriers/types.ts`, `server/couriers/econt.ts`; Test `server/courierEcont.test.ts`

**Interfaces — Produces:**
- `type CourierId = "econt" | "speedy"`
- `type CourierOffice = { courier: CourierId; code: string; name: string; city: string; postcode: string; address: string; lat: number | null; lng: number | null; hours: string; isLocker: boolean }`
- `econtOfficesFromResponse(json: unknown): CourierOffice[]` (чиста)
- `econtPriceFromResponse(json: unknown): number | null` (чиста; `label.totalPrice`)
- `fetchEcontOffices(cfg: EcontConfig): Promise<CourierOffice[]>`, `quoteEcont(cfg, officeCode: string, weightKg: number): Promise<number | null>`; `type EcontConfig = { url: string; username: string; password: string }`

- [ ] Тест `maps Econt offices`: примерен обект с `code:"1234"`, `name`, `address.city.name:"Силистра"`, `address.city.postCode:"7500"`, `address.fullAddress`, `address.location.latitude/longitude`, `isAPS:true` → `{courier:"econt", code:"1234", city:"Силистра", postcode:"7500", lat, lng, isLocker:true}`; офис с `location:null` → `lat:null,lng:null`.
- [ ] Тест `reads Econt calculated price`: `{label:{totalPrice:5.4}}` → `5.4`; `{}` → `null`; `{label:{totalPrice:"x"}}` → `null`.
- [ ] Пусни → FAIL. Имплементирай. `hours`: от `normalBusinessHoursFrom/To` (epoch ms → „HH:mm–HH:mm“ в Europe/Sofia), иначе `""`. Заявки: POST JSON, Basic auth, таймаут 8 s (`AbortSignal.timeout`). Офиси: `Nomenclatures/NomenclaturesService.getOffices.json` с `{countryCode:"BGR"}`. Цена: `Shipments/LabelService.createLabel.json` с `{mode:"calculate", label:{senderClient:{name:"ЖОАН"}, senderAddress:{city:{country:{code3:"BGR"},name:"Силистра",postCode:"7500"}}, receiverOfficeCode, packCount:1, shipmentType:"PACK", weight}}`; грешка → `null`.
- [ ] Пусни → PASS. Ръчно: `fetchEcontOffices` срещу demo връща > 100 офиса с координати.
- [ ] Commit.

### Task 2: Спиди адаптер

**Files:** Create `server/couriers/speedy.ts`; Test `server/courierSpeedy.test.ts`

**Interfaces — Produces:** `speedyOfficesFromResponse(json: unknown): CourierOffice[]`, `speedyPriceFromResponse(json: unknown): number | null`, `fetchSpeedyOffices(cfg: SpeedyConfig)`, `quoteSpeedy(cfg, officeCode, weightKg)`; `type SpeedyConfig = { username: string; password: string }`.

- [ ] Тест: офис `{id:77, name, type:"APT", address:{fullAddressString, siteName, postCode, x, y}, workingTimeFrom:"09:00", workingTimeTo:"18:00"}` → `{courier:"speedy", code:"77", isLocker:true, lng:x, lat:y, hours:"09:00–18:00"}`; без `x/y` → `null`.
- [ ] Тест цена: `{calculations:[{serviceId:505, price:{total:6.1}}]}` → `6.1`; с `error` → `null`.
- [ ] FAIL → имплементирай: base `https://api.speedy.bg/v1`; тяло с `userName`, `password`, `language:"BG"`. Офиси: `/location/office` с `countryId:100` (провери с `/location/country` `isoAlpha2:"BG"` при първия акаунт и коригирай константата). Цена: `/calculate` с `recipient:{privatePerson:true, pickupOfficeId:Number(code)}`, `service:{serviceIds:[505]}`, `content:{parcelsCount:1,totalWeight:weightKg}`, `payment:{courierServicePayer:"RECIPIENT"}`. Полетата за адрес/координати се потвърждават с реален отговор; ако се различават — поправи mapper-а и теста.
- [ ] PASS → Commit.

### Task 3: Сървърна услуга и tRPC

**Files:** Create `server/couriers/shippingService.ts`; Modify `server/routers.ts` (нов `shipping` router), `server/_core/security.ts:13`; Test `server/shippingService.test.ts`

**Interfaces — Consumes:** Task 1–2. **Produces:**
- `getCourierOffices(): Promise<CourierOffice[]>` (кеш 24 ч на куриер; грешка → празно за него + `console.warn` без пароли)
- `getCourierQuote(courier: CourierId, officeCode: string, ip: string): Promise<{ priceEur: number | null }>` (кеш 15 мин по `courier:code`; лимит 30/мин на IP → `Error("Твърде много заявки за цена. Опитайте след минута.")`)
- tRPC `shipping.offices` (public query) → `CourierOffice[]`; `shipping.quote` (public query, input `{ courier: z.enum(["econt","speedy"]), officeCode: z.string().trim().min(1).max(32) }`)

- [ ] Тестове с подменени адаптери (`vi.mock`): само Еконт конфигуриран → само еконт офиси; адаптер хвърля → `[]` и няма throw; втори `quote` за същия офис не вика адаптера; 31-ви `quote` от едно IP за минута хвърля; `quote` при грешка → `{priceEur:null}`.
- [ ] FAIL → имплементирай; CSP: `img-src ... https://*.tile.openstreetmap.org`.
- [ ] PASS; `tsc` чист → Commit.

### Task 4: Карта и избор в поръчката

**Files:** Create `client/src/components/CourierOfficePicker.tsx`, `client/src/lib/courierAddress.ts`; Modify `client/src/pages/Checkout.tsx`, `client/src/index.css`, `package.json` (`leaflet`, `leaflet.markercluster`, `@types/leaflet`); Test `server/courierAddress.test.ts`

**Interfaces — Produces:**
- `courierOfficeAddress(office: CourierOffice, priceEur: number | null): { address: string; region: string; city: string; postcode: string }` — адрес `Офис Еконт: <име> (<код>) — <адрес>; ориентировъчна доставка 5,40 €` (или `…; цена за доставка: потвърждава се от оператор`); `region` = града; Спиди → „Офис Спиди“; автомат → „Автомат Еконт/Спиди“.
- `<CourierOfficePicker value={selected} onChange={(office, priceEur) => void} />`

- [ ] Тест за `courierOfficeAddress` с горните низове (цена с „,“ и „ €“; `null` цена; автомат).
- [ ] FAIL → имплементирай → PASS.
- [ ] `pnpm add leaflet leaflet.markercluster` + `-D @types/leaflet`.
- [ ] Picker: търсачка (град/име/код), филтър Еконт/Спиди, карта (React `lazy` + `import("leaflet")` в effect, център България, клъстери, маркери: Спиди червен `#D71920`, Еконт тъмносин `#1f3a93`), при празен `shipping.offices` — текст „Изборът на офис временно не е наличен.“ вместо карта; списък до 50 резултата под картата (бутони, достъпни с клавиатура). Избор → `shipping.quote` → карта с име, адрес, часове, цена или „Цената ще бъде потвърдена от оператор.“
- [ ] Checkout: трети радио бутон „До офис на куриер“ между двата; скрива адреса; валидация „Изберете офис на куриер.“; payload от `courierOfficeAddress`; „Какво следва“: „Пратката се изпраща до избрания офис; ориентировъчната цена е за 2 кг.“
- [ ] Commit.

### Task 5: Проверка от край до край и документация

**Files:** Modify `docs/INTEGRATIONS.md`, `docs/KNOWN_ISSUES.md`

- [ ] Локално с Еконт demo (`ECONT_API_URL=https://demo.econt.com/ee/services`, `iasp-dev`): Playwright 375 px и 1440 px — избор на град „Силистра“, клик на офис, цена се показва, изпращане на заявка; адресът в базата съдържа „Офис Еконт“; тестовият запис се изтрива.
- [ ] Без конфигурация на куриери: опцията показва „Изборът на офис временно не е наличен.“ и формата работи с другите два начина.
- [ ] `tsc`, `vitest` (без нови провали спрямо 6-те известни), production build.
- [ ] Документирай `.env` ключовете и как се включва Спиди; commit + push.
