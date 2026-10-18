
# Поправка: upload квадратът не отваряше file picker
- [x] Product editor fieldset-ът вече се блокира само при липса на `products.write`; липсващите категории не блокират избора на снимки.
- [x] Category select-ът се управлява отделно и остава disabled без заредени категории; бутонът за запис остава защитен до валидна категория.
- [x] Пълна проверка: 63 Vitest файла / 247 теста, TypeScript, production client+SSR build и diff check преминаха.
