# Данни, нужни за transactional email на клиентски профили

За да се активира реалното изпращане на линкове за активация и възстановяване на парола, е нужен одобрен transactional email доставчик и проверен фирмен sender домейн. Към момента приложението генерира еднократни, ограничени по време token-и, но не изпраща тези token-и към клиенти автоматично.

## Какво трябва да бъде предоставено

Изберете един от двата поддържими подхода:

1. SMTP услуга: host, port, encryption mode (`TLS`/`STARTTLS`), username, password или app password, verified sender address и display name.
2. HTTPS email API: endpoint, secret API key, verified sender address, display name и евентуален region/project ID.

Нужни са и потвърдени DNS записи за sender домейна: SPF, DKIM и при възможност DMARC. Използваният sender адрес трябва да е фирмен, например `noreply@joan.bg`, а не личен Gmail адрес.

## Предложена конфигурация

Секретите се пазят извън Git и извън публичната директория:

```text
EMAIL_PROVIDER=smtp|http
EMAIL_FROM=noreply@joan.bg
EMAIL_FROM_NAME=ЖОАН
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASSWORD=...
EMAIL_API_URL=...
EMAIL_API_KEY=...
CUSTOMER_AUTH_ORIGIN=https://joan.bg
```

Не е нужно всички променливи да се задават едновременно. При HTTP provider SMTP полетата остават празни; при SMTP provider API полетата остават празни.

## Задължителна проверка преди включване

Първо се изпраща тестово съобщение само до фирмен тестов адрес. Проверяват се HTTPS линкът, срокът на token-а, еднократната употреба, invalid/expired поведението, видимото име на фирмата и доставяемостта. Едва след това се разрешава изпращане към реални клиентски адреси.

В production логовете никога не се записват raw token-и, пароли, API ключове или пълни лични данни. Записва се само provider message ID, типът на съобщението, customer ID, timestamp, статусът и безопасен error code. При временна provider грешка се използва ограничен retry с backoff; при окончателна грешка администраторът вижда задача за повторно изпращане, без token-ът да се показва.

## Какво да изпратите за реалното включване

Изпратете името на избрания доставчик, дали ще се използва SMTP или API, sender домейна и потвърждение, че SPF/DKIM са настроени. Secret стойностите не се изпращат в чат; те се въвеждат през защитената конфигурация, когато provider-ът е одобрен.
