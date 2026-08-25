# Joan.bg: cPanel day-one checklist за SuperPro

Използвайте този checklist при първия достъп. Целта е да се направи решение за staging, а не директно прехвърляне на `joan.bg`.

## До 20 минути: потвърждение на средата

- [ ] В `Software` има **Setup Node.js App**.
- [ ] Записана е максималната предлагана Node.js версия.
- [ ] Има SSH/SFTP достъп и е потвърдено `node -v`.
- [ ] Има възможност за нова staging MySQL база и отделен database user.
- [ ] Има свободен subdomain за staging и SSL.
- [ ] Има достъп до Node application/error logs и restart control.
- [ ] Има достатъчно диск за app bundle, database restore и media archive.

## Решение веднага след проверката

| Резултат | Следваща стъпка |
|---|---|
| Няма Setup Node.js App | Спираме full-stack staging. Не пипаме DNS и не качваме production data. |
| Runtime е под Node 20.11 | Означаваме средата като compatibility candidate. Първо се прави отделна runtime adaptation и proof; няма production ангажимент. |
| Runtime е Node 20.11+ | Качваме source release към staging и изпълняваме preflight. |
| Runtime и staging proof са успешни | Едва тогава прехвърляме ограничен staging DB/media комплект за функционален тест. |

## Преди какъвто и да е DNS запис

- [ ] Staging homepage, catalogue, product, media, brochure, redirects и sitemap са валидирани.
- [ ] Local admin подходът е готов; текущият managed OAuth не се използва като production dependency.
- [ ] SQL и media restore proof е документиран с hashes и timestamp.
- [ ] Има rollback target и final backup преди промяна на DNS.
- [ ] Собственикът е одобрил cutover прозореца.

> Ако някой от тези редове не е изпълнен, правилното действие е да се остави текущият публикуван сайт активен. Не се правят частични DNS промени.
