
# Поправка: категории и качване на снимки в admin product editor
- [x] Добавен е отделен защитен `productCategories` query: оператор с `products.write` вече може да зарежда категориите за dropdown-а, без да има отделно меню „Категории“.
- [x] Формата вече не се блокира само заради липсващо `categories.read`, ако има налични категории и потребителят има `products.write`.
- [x] Product create/update/image upload използват authenticated staff identity за audit/storage действията.
- [x] При upload се показва конкретната server причина вместо общото съобщение „Качването прекъсна“.
- [x] Regression suite: 63 тестови файла / 246 теста, TypeScript, production build и diff check преминаха. Реален browser upload не е извършван, защото текущата Sandbox browser сесия е без администраторски вход.
