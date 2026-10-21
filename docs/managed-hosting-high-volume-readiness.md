# Joan.bg: readiness оценка за висок оборот на управлявано Node хостване

**Статус:** предварителна оценка. Тя не е SLA, гаранция за непрекъсваемост или потвърждение за капацитет при конкретен брой поръчки/посещения.

## Какво е потвърдено в приложението

| Област | Наличен механизъм | Ограничение |
|---|---|---|
| Данни | Приложението използва управлявана MySQL-съвместима database чрез `DATABASE_URL` | Няма потребителски проверен restore drill за текущата production база |
| Медии | Upload/download минават през managed object storage с presigned URLs | Няма независим фирмен media export/manifest, тестван от production snapshot |
| Приложение | Node/Express SSR приложение с production build и tests | Няма проведен load test с реалния трафик и пикове на магазина |
| Code recovery | Има versioned checkpoints и private source repository integration | Checkpoint не е заместител на database/media restore plan |

## Какво не може да бъде обещано сега

Не може честно да се обещае, че няма да се изгубят данни, че услугата никога няма да спре или че текущата среда е оразмерена за „изключително голям оборот“. Такива твърдения изискват договорен SLA, лимити, capacity/load test, наблюдение, alerting и успешно тествано възстановяване.

## Go/no-go условия преди насочване на joan.bg

- [ ] Пълен, защитен database export и успешно restore proof в изолирана среда.
- [ ] Пълен media export с SHA-256 manifest и sample restore proof.
- [ ] Written confirmation за production hosting limits, availability, incident support и подходящ режим при висок трафик.
- [ ] Baseline performance/load test за homepage, catalogue, product и request flow при целеви peak traffic.
- [ ] Monitoring за availability, 5xx rate, latency, database errors, media errors и критични request failures.
- [ ] Named incident owner, escalation channel, rollback owner и документирана communication процедура.
- [ ] Staging cutover rehearsal и DNS rollback rehearsal без загуба на заявки.

## Решение към момента

Преди тези условия да са изпълнени, правилният статус е **не одобрено за high-volume production cutover**. Текущата среда остава приложима за development и controlled staging, но не трябва да бъде представяна като доказано production решение за голям онлайн магазин.

## Повторяем локален SSR baseline

Добавен е read-only скриптът `scripts/measure-public-load.mjs`. Той изпраща паралелни GET заявки без вход, без заявки за поръчки и без промени в базата. Изпълнението с 8 заявки на маршрут и concurrency 4 върху локалния dev server даде 32/32 отговора `200`: `/` p50 162 ms / p95 853 ms, `/products` p50 299 ms / p95 322 ms, `/products?page=2` p50 129 ms / p95 605 ms и `/checkout` p50 106 ms / p95 152 ms.

Тези числа са локален regression baseline, а не доказателство за production капацитет. За приемане на high-volume deployment трябва да се повтори срещу staging build с реално избрани peak параметри, database snapshot, media restore, monitoring и одобрени hosting limits.

Пример: `LOAD_TEST_BASE_URL=https://staging.example LOAD_TEST_REQUESTS=50 LOAD_TEST_CONCURRENCY=10 node scripts/measure-public-load.mjs`.

## Завършена operational assessment оценка

Оценката е завършена като **go/no-go assessment**, а не като необосновано одобрение за production. Рискът остава висок, докато външните входове не бъдат потвърдени от hosting доставчика и собственика:

| Област | Текущ риск | Доказателство | Условие за намаляване на риска |
|---|---|---|---|
| Database backup/restore | Висок | Има runbook, но няма production restore proof | Консистентен dump, изолиран restore и row-count/sample validation |
| Media recovery | Висок | Има export/manifest процедура, но няма production snapshot proof | SHA-256 manifest и sample restore на продукт, gallery, PDF и brand asset |
| Capacity | Висок | Има локален 32-request SSR baseline | Staging load test с одобрени peak параметри и реален database/media snapshot |
| Availability/monitoring | Висок | Има health/readiness проверки, но няма потвърден alerting owner | Uptime, 5xx, latency, DB и media alerts с on-call получател |
| Incident response | Среден | Има rollback и recovery runbooks | Назначени owner-и, escalation канал и rehearsal с timestamped ledger |
| DNS rollback | Висок | Има обратим план, но няма одобрен target и rollback owner | Подписан cutover checklist и проверен стар DNS target |

### Минимален monitoring contract преди cutover

Staging/production трябва да има публичен read-only health check и отделни наблюдения за: HTTP availability, 5xx rate, p50/p95 latency, Node process restarts, database connection/query errors, storage/media 4xx/5xx, failed order/contact submissions и disk/backup capacity. Всеки сигнал трябва да има праг, owner, escalation channel, timestamp на последната проверка и ясно действие за rollback или safe mode. Само наличието на логове не се счита за monitoring.

### Acceptance worksheet

Този worksheet се попълва при реален staging rehearsal; празните полета са съзнателно blockers, а не PASS стойности.

| Gate | Owner | Evidence ID / timestamp | Result |
|---|---|---|---|
| Database restore |  |  | `PENDING` |
| Media manifest/sample restore |  |  | `PENDING` |
| Peak load and error budget |  |  | `PENDING` |
| Monitoring alert delivery |  |  | `PENDING` |
| Incident/rollback rehearsal |  |  | `PENDING` |
| DNS cutover approval |  |  | `PENDING` |

**Assessment decision:** `NO-GO` за high-volume production DNS cutover до попълване на всички gates. Това е контролирано, проверимо решение; не блокира development/staging работа и не променя текущия публикуван сайт.
