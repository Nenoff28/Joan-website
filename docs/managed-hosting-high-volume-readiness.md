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
