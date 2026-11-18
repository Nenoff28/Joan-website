# Plugin Workflow — одит

_Одит от 2026-11-17 (сесия, стартирана в 10:17:51). Източници: `ListPlugins` (акаунт), `plugin.json`, `SKILL.md`, `hooks/hooks.json` и `.mcp.json` на всеки плъгин в `%LOCALAPPDATA%\Claude-Data\…\rpm\…\plugin_*`; проверка на нужните CLI в Windows PATH. Тази версия заменя предишната, която погрешно отчиташе OmniRoute и MemPalace като неинсталирани._

## Текущо състояние (2026-11-17, след инсталацията на предпоставките)

Инсталирано: Python 3.12.10 (winget, user scope), `uv` 0.13.8, `graphifyy` 0.9.111 и `mempalace` 3.12.0 (`uv tool`, в `~/.local/bin`), `@playwright/cli` 0.1.24 и `omniroute` 3.8.53 (`npm -g`), `@playwright/test` 1.65.1 (devDependency на проекта) + Chromium, Impeccable engine 0.1.25 (`~/.impeccable/bin`, SHA-256 проверен от launcher-а).

| Плъгин | Статус | Проверено с |
|---|---|---|
| Superpowers | ✅ | SessionStart hook инжектира `using-superpowers` |
| Ponytail | ✅ | hooks активни, `~/.claude/.ponytail-active` съществува |
| frontend-design, Headroom | ✅ | само инструкции, без външни зависимости |
| UI UX Pro Max | ✅ | `python …\skills\ui-ux-pro-max\scripts\search.py "<query>" --domain ux` връща резултати. ⚠ Пътят в SKILL.md (`${CLAUDE_PLUGIN_ROOT}/.claude/skills/…`) е грешен — ползвайте `${CLAUDE_PLUGIN_ROOT}/skills/ui-ux-pro-max/scripts/search.py` |
| Impeccable | ✅ | engine е свален; симулиран PostToolUse hook → exit 0, без файлове в проекта |
| Playwright | ✅ | `playwright-cli open http://localhost:3000/products` → заглавие „Всички продукти \| ЖОАН“; `pnpm exec playwright --version` → 1.65.1 |
| Graphify | ✅ CLI | `graphify --version` → 0.9.111. Не е строен граф (изисква одобрение — праща съдържание на файлове към LLM) |
| MemPalace | ✅ MCP в сесията | `mempalace_status` → 7 836 drawers в wing `joan_website_main` (backend, frontend, drizzle, documentation, scripts…), sqlite integrity OK. Palace: `~/.config/mempalace/palace`; `--no-llm`, embedding `embeddinggemma`, mine спазва `.gitignore` (без `.env`) |
| OmniRoute | ⚠ MCP в сесията, gateway работи | `omniroute_get_health` → health OK; `resilience`/`rateLimits` → 401, защото липсва `OMNIROUTE_API_KEY`. Каталог на модели: 0 — **няма добавени доставчици**. Нужно от потребителя: Dashboard → Endpoints → ключ → `setx OMNIROUTE_API_KEY "<key>"` + рестарт на app; Dashboard → Providers → поне един доставчик |
| GitHub MCP | ✅ MCP в сесията | `get_me` → потребител `Nenoff28`. Проектът още няма GitHub remote |

### Важно за OmniRoute

- CLI-то винаги зарежда `.env` от **текущата папка**. Стартирайте gateway-я от `%USERPROFILE%`, не от проекта (иначе взима `PORT=3000` и `JWT_SECRET` на магазина). `DATABASE_URL` не се ползва от OmniRoute.
- Gateway-ят не тръгва сам след рестарт на Windows: `cd $env:USERPROFILE; omniroute serve --daemon --no-open --no-tray --port 20128`.
- MCP сървърите на OmniRoute и MemPalace се свързват само ако са в PATH на Claude app при неговия старт → след инсталация е нужен рестарт на app.

## Как работи зареждането (проверено)

- Плъгините идват от claude.ai акаунта (`ListPlugins`: 11 плъгина, всички `enabled`). Desktop app ги сваля в `Claude-Data\…\rpm\`. **Не са** в `~/.claude/plugins` — там е само каталогът на marketplace-а.
- Skills, hooks и MCP се зареждат **само при старт на сесия**. Плъгин, свален по-късно, не е активен до нова сесия.
- Skill се активира, когато Claude го извика със Skill tool (`<plugin>:<skill>`) или когато потребителят напише `/<skill>`. Автоматично се изпълняват **само hooks**.
- Hooks се изпълняват от процеса на Claude app. В неговия PATH няма `node`, защото Node.js е инсталиран след стартирането на app-а → **нужен е рестарт на Claude app**.

## Обобщение

| Plugin (версия) | Инсталиран | Активен в тази сесия | Предоставя | Кога да се ползва в JOAN | Автоматично? | Защо не е ползван досега | Конфликти / рискове |
|---|---|---|---|---|---|---|---|
| **Superpowers** 7.0.2 | ✅ | ✅ 14 skills + SessionStart hook (работи — инжектира `using-superpowers`) | `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `systematic-debugging`, `test-driven-development`, `verification-before-completion`, `requesting-/receiving-code-review`, `finishing-a-development-branch`, `using-git-worktrees`, `writing-skills`, `diagnosing-superpowers`, `using-superpowers` | Нова функция → `brainstorming` → `writing-plans`; бъг/падащ тест → `systematic-debugging`; логика в `server/` → `test-driven-development`; преди отчет → `verification-before-completion` | Само hook-ът. Skills — по преценка на Claude (hook-ът изисква извикване „при 1% шанс“) | Одитът беше read-only. **При поправката на миграциите `systematic-debugging` и `verification-before-completion` трябваше да се извикат, но не бяха** — проверките бяха направени ръчно | Агресивното „ИЗВИКАЙ ПРЕДИ ВСИЧКО“ се бие с Ponytail („най-малката промяна“) и с CLAUDE.md („без излишна церемония за прости поправки“). `using-git-worktrees`/`finishing-a-development-branch` предлагат merge/PR — CLAUDE.md изисква одобрение |
| **frontend-design** 1.1.1 | ✅ | ✅ 1 skill | `frontend-design` — естетическа посока, типография, „дизайн, който не прилича на шаблон“ | **Само** нови секции/лендинги с одобрен редизайн | Не | Не е имало UI задача | ⚠ Скилът цели **нова, различна визуална идентичност** — противоречи на CLAUDE.md („запази дизайна на ЖОАН“). Припокрива се с Impeccable и UI UX Pro Max |
| **UI UX Pro Max** 2.15.0 | ✅ | ✅ 7 skills | `ui-ux-pro-max` (локална база: стилове, палитри, шрифтове, UX правила; `scripts/search.py`), `ui-styling` (shadcn/Tailwind), `design-system` (tokens), `design`, `brand`, `banner-design`, `slides` | UX/достъпност ревю, shadcn/Tailwind компоненти (проектът ползва shadcn + Tailwind 4) | Не | Няма UI задача | ❌ `search.py` изисква Python 3 — **има само Windows Store stub**. ⚠ SKILL.md сочи грешен път `${CLAUDE_PLUGIN_ROOT}/.claude/skills/…`; реалният е `skills/ui-ux-pro-max/scripts/search.py`. `design`/`banner`/`slides` извикват външни AI услуги — неприложими |
| **Impeccable** 4.9.2 | ✅ | ✅ 1 skill (24 подкоманди) + 5 agents + 3 hooks | `/impeccable audit·critique·polish·harden·adapt·…`; agents `impeccable-finish-reviewer`, `-motion-reviewer`, `-documenter`, `-asset-producer`, `-manual-edit-applier`; hooks SessionStart, **PostToolUse(Edit\|Write)**, Stop | `audit`/`critique`/`polish`/`harden` за съществуващи страници — най-подходящият design skill за поддръжка | Hooks — да. Skill — не | Няма UI задача | ⚠ Hooks пускат `impeccable.cmd`, който **тегли engine binary** при първо изпълнение (няма `bin/` и cache). Не е проверено дали изобщо се изпълняват. PostToolUse сработва след **всяка** редакция, включително за не-UI файлове |
| **Playwright** 1.66.0 | ✅ | ✅ 3 skills | `playwright-cli` (браузър от CLI, `--mobile`, `--device`), `playwright-trace`, `playwright-component-testing` | E2E/responsive регресии на каталог, количка, checkout | Не | ❌ `playwright-cli`/`@playwright/test` не са инсталирани (не са в `devDependencies`). Ползван е вграденият браузър на Claude | Припокрива се с вградения браузър и Claude in Chrome. Инсталацията изисква одобрение |
| **Ponytail** 5.3.3 | ✅ | ⚠ 6 skills — да; **3 hooks — не работят** | `ponytail` (lite/full/ultra), `ponytail-review`, `ponytail-audit`, `ponytail-debt`, `ponytail-gain`, `ponytail-help`; hooks SessionStart / SubagentStart / UserPromptSubmit (`node -e …`) | Всяка промяна по кода (минимален diff); `ponytail-review` за ревю; `ponytail-audit` за одит на repo | Hooks трябва да активират режима автоматично | ❌ Hooks изискват `node`, който го нямаше при старта → няма флаг `~/.claude/.ponytail-active`, правилата не са инжектирани. Skill-ът не е извикан ръчно | Стилът на отговор („1–2 реда в края“) се бие с формата на отчет от CLAUDE.md. Три review skills се припокриват: `ponytail-review`, `superpowers:requesting-code-review`, вграденият `code-review` |
| **Graphify** 0.9.111 | ✅ | ✅ 1 skill | `/graphify` build/query/path/explain → `graphify-out/` (graph.json, HTML, GRAPH_REPORT.md) | Архитектурни въпроси за голямата кодова база | Не | ❌ Изисква Python + `uv tool install graphifyy` — няма ги | Описанието („any question about a codebase“) е прекалено широко. Пише `graphify-out/` в проекта — трябва да влезе в `.gitignore`. Може да изпрати съдържание на файлове към LLM за извличане |
| **Headroom** 0.44.0 | ✅ | ✅ 1 skill | `headroom` — добавя `compress()` от `headroom-ai` в Python/TS приложение, което праща големи данни към LLM | Само ако се работи по `server/aiContentService.ts` (LLM генериране на продуктово съдържание) | Не | Не е имало такава задача | Добавя npm/pip зависимост — нужно е одобрение. **Не** намалява токените на самия Claude Code |
| **OmniRoute** 3.8.53 | ✅ | ❌ | `omniroute` skill + MCP (`cmd /c omniroute --mcp`, ~110 `omniroute_*` tools: routing към други модели, quota, web search/fetch) | Втори мнения от други модели; web fetch, когато WebFetch е блокиран | Не | ❌ Свален в 10:20:21, след старта на сесията. Липсва и `omniroute` CLI, gateway на `localhost:20128` не отговаря, няма `OMNIROUTE_API_KEY` | ⚠ Праща код/данни към **външни модели** — забранено за клиентски данни без одобрение. Припокрива се с WebSearch/WebFetch |
| **MemPalace** 3.12.0 | ✅ | ❌ | `mempalace` (setup), `mempalace-recall`, `mempalace-task` + MCP (`cmd /c mempalace-mcp`) | Памет между сесии и машини | Не | ❌ Свален в 10:20:21, след старта на сесията. Липсват `mempalace-mcp`, `uv` и Python | Дублира вградената auto-memory на Claude Code (`~/.claude/projects/…/memory`) и `docs/`. Трябва да се избере един източник |
| GitHub MCP | ✅ | ❌ | GitHub API tools | PR/issues | — | MCP: `Authorization header is badly formatted` (преинсталиран в 12:20) | Remote засега няма; `gh` CLI не е инсталиран |

## Друго налично в сесията (не са плъгини)

- **Вградени skills:** `code-review`, `security-review`, `simplify`, `run`, `init`, `update-config`, `fewer-permission-prompts`, `loop`, `schedule`, `claude-api`, `anthropic-skills:*` (built-in-browser, chrome-browser, docs, pdf, xlsx, …), artifact-*.
- **Agents:** `claude`, `general-purpose`, `Explore`, `Plan`, `claude-code-guide`, `statusline-setup`, `web-fetch`, `impeccable:*` (5).
- **MCP:** вграден браузър (`Claude_Browser` — ползван за визуална проверка), Claude in Chrome, `terminal`, `visualize`, `ccd_*` (сесии, PR, settings), Claude Docs connector, `mcp-registry`, `scheduled-tasks`.
- **Hooks на ниво потребител/проект:** няма (`~/.claude/settings.json` съдържа само marketplace, проектът няма `.claude/settings.json`).

## Какво трябва, за да заработи всичко (изисква одобрение)

1. **Рестарт на Claude app** → `node` влиза в PATH (Ponytail hooks), OmniRoute и MemPalace се зареждат, GitHub MCP се свързва отново.
2. **Python 3** (истински, не Store stub) → UI UX Pro Max `search.py`, Graphify, MemPalace.
3. По желание: `uv` + `graphifyy`; `mempalace`; OmniRoute gateway + `OMNIROUTE_API_KEY`; `@playwright/test` като devDependency.
4. Решение: MemPalace **или** вградената auto-memory; OmniRoute — разрешен ли е за код на проекта.

## Препоръчано разпределение на ролите (без припокриване)

| Задача | Водещ skill | Допълнителни | Не ползвай |
|---|---|---|---|
| Бъг / падащ тест | `superpowers:systematic-debugging` | `ponytail` (минимален fix) | — |
| Нова функция | `superpowers:brainstorming` → `superpowers:writing-plans` | `superpowers:test-driven-development` | `using-git-worktrees` без одобрение |
| UI поправка/полиране на съществуваща страница | `impeccable` (`audit`/`polish`/`harden`) | `ui-ux-pro-max:ui-ux-pro-max` за UX/a11y правила | `frontend-design` (редизайн) |
| Нов UI компонент в съществуващия стил | `ui-ux-pro-max:ui-styling` (shadcn/Tailwind) | `impeccable critique` | `design`, `banner-design`, `slides` |
| Нова секция/редизайн (само с одобрение) | `frontend-design` | `impeccable` | — |
| Браузър проверка | вграден браузър (desktop + mobile) | `playwright:playwright-cli` след инсталация | — |
| Code review | `code-review` (вграден) | `ponytail-review` за излишен код | Две ревюта по един и същ diff |
| Одит на repo | `ponytail:ponytail-audit` | `security-review` | — |
| Преди отчет „готово“ | `superpowers:verification-before-completion` | — | — |
