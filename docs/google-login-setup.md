# Google login за customer profiles

Този flow е **Google OpenID Connect authorization-code flow** само за `customer_profiles`. Той е отделен от Manus OAuth и никога не използва Google имейл като доказателство за съвпадение със стар клиентски профил.

## Какво трябва да предостави собственикът

Създайте OAuth 2.0 Web application client в Google Cloud Console и предоставете на deployment средата следните server-only променливи:

```text
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://joanredesign-gcqdscde.manus.space/api/customer/google/callback
```

`GOOGLE_CLIENT_SECRET` не трябва да се изпраща към браузъра, да се връща от `customer.googleStatus`, да се commit-ва или да се записва в тази документация. Докато credentials липсват, `customer.googleStatus` връща `configured: false`, а бутонът в customer account е disabled.

Точният production callback URL е:

```text
https://joanredesign-gcqdscde.manus.space/api/customer/google/callback
```

Добавете го едно към едно в Google Cloud Console. При migration към друг домейн сменете `GOOGLE_REDIRECT_URI` и регистрирайте новия HTTPS callback URI в Google клиента. Не се използват Host header, query параметри или непроверен client `returnURL` за конструиране на callback адрес.

## Поведение на входа

1. `/api/customer/google/start` създава случаен `state`, `nonce` и PKCE verifier.
2. Signed краткотрайна `HttpOnly`, `Secure`, `SameSite=Lax` cookie пази тези стойности. Authorization request използва само `openid email profile` и PKCE `S256`.
3. Callback-ът сравнява `state` constant-time, приема callback само веднъж, обменя authorization code с Google и използва същия redirect URI.
4. ID token се валидира server-side с Google JWKS, `RS256`, issuer, audience, nonce и expiry. Само `email_verified=true` се приема.
5. Google `sub` е външният стабилен идентификатор и се записва в `customer_google_identities.subject`. Имейлът се нормализира само за display/duplicate lookup, а не като Google identity key.

Google документират, че `state` е anti-forgery стойност, `nonce` защитава от replay, ID token трябва да се валидира със server-side signature/issuer/audience/expiry checks, а стабилният идентификатор е `sub`, не email [1] [2]. Authorization-code exchange и точният `redirect_uri` са описани в web-server guide [3].

## Account linking и роли

Няма silent auto-link. Ако Google `sub` вече е свързан, се влиза в този активен customer profile и текущата database роля не се променя. Ако Google email съвпадне със съществуващ password/legacy профил, callback-ът спира с `google=conflict`; потребителят първо трябва да докаже достъп с existing password. Няма публичен shortcut за свързване само по email. Explicit linking flow може да бъде добавен отделно и трябва да изисква вече authenticated същия customer, отделен intent и повторна проверка.

Ново създаденият Google профил е `active`, има `emailVerifiedAt`, няма `legacyCustomerId`, `accessRoleId` или `staffUserId` и не получава admin/staff достъп по имейл. Ролите се назначават само в собствената база чрез административния access-role flow. Това запазва portable deployment поведението и не зависи от Google Workspace домейн.

## Registration и operational notes

Email/password registration приема име, фамилия, optional phone, email, password с минимум 12 символа и explicit приемане на условията. Паролата се съхранява чрез съществуващия scrypt формат. Новите профили започват с `legacyCustomerId=null`, `accessRoleId=null`, `staffUserId=null` и стандартен customer достъп; client input няма role полета.

Регистрацията използва normalized email, database unique constraint и bounded process-local rate-limit buckets за IP и email. Production edge/WAF rate limiting остава препоръчителен при multi-instance deployment. Login/activation mutations използват същата same-origin защита, когато са интегрирани от главния router.

Google login не изпраща access tokens или ID tokens към клиента. При provider error, state/nonce mismatch, callback replay, disabled profile или conflict не се създава нова сесия и няма open redirect.

## Migration checklist

- Изискайте credentials от собственика; не измисляйте client ID/secret.
- Регистрирайте точния HTTPS production callback URI в Google Cloud Console.
- Задайте трите `GOOGLE_*` env променливи server-side и рестартирайте deployment-а.
- Проверете `customer.googleStatus` да връща `configured: true`, без да връща secret.
- Изпълнете migration-а за `customerProfiles` nullable fields и `customerGoogleIdentities` чрез основния deployment flow.
- След migration тествайте нов Google профил, повторен вход със същия `sub`, conflict със стар password профил и disabled profile.
- При преместване на домейна променете redirect URI и Google Cloud Console registration едновременно.

## References

[1]: https://developers.google.com/identity/openid-connect/openid-connect "Google OpenID Connect"
[2]: https://developers.google.com/identity/openid-connect/reference "Google OpenID Connect API Reference"
[3]: https://developers.google.com/identity/protocols/oauth2/web-server "Google OAuth 2.0 for Web Server Applications"
