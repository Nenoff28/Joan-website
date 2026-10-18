
# Поправка: „Невалиден източник на административната заявка“
- [x] Origin защитата вече разпознава host, x-forwarded-host, x-original-host и стандартен Forwarded header при reverse proxy.
- [x] Чуждите Origin адреси продължават да се отхвърлят; добавен е regression тест за валиден proxy host и невалиден чужд host.
- [x] Пълна проверка: 63 Vitest файла / 247 теста, TypeScript, production client+SSR build и diff check преминаха.
