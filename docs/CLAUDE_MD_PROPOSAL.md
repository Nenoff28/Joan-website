# Предложение: нова секция за CLAUDE.md

_Предложение от одита на 2026-11-17 (виж `docs/PLUGIN_WORKFLOW.md`). **Приложено в `CLAUDE.md` на 2026-11-17** (секция „Skills, plugins and tools“ и редът „Плъгини“ в „Response format“). Неприложено остава само „Допълнително“ по-долу. Файлът се пази като обосновка на промяната._

## Защо текущата секция не работи надеждно

1. **„Discover and consider these plugins if installed“** не дава конкретно правило: няма точни имена на skills (`superpowers:systematic-debugging`) и няма тригер „задача X → skill Y“. Затова извикването остава на преценка.
2. **Няма приоритет при конфликт.** Superpowers казва „извикай skill преди всичко“, Ponytail — „най-малката промяна, кратък отговор“, frontend-design — „различна визуална идентичност“. CLAUDE.md не казва кое печели.
3. **Таблицата съдържа предположения:** OmniRoute и MemPalace са описани като „може би“, а тук не са ползваеми. Липсват реалните предпоставки (Python, Node в PATH на app-а, рестарт).
4. **Няма проверимо правило за отчета.** „Плъгини:“ не изисква да се изброят реално изпълнените извиквания на Skill tool.
5. **„Read the relevant plugin manifest and SKILL.md before relying“** е непрактично: skills са в `Claude-Data`, а Skill tool и без това зарежда SKILL.md.

## Предложен текст (английски, за да се съчетава с останалия CLAUDE.md)

```markdown
## Skills, plugins and tools

Skills run only when invoked through the Skill tool (or by the user typing `/<skill>`); only hooks run automatically. The routing table below is mandatory: before starting a matching task, invoke the listed lead skill via the Skill tool. If a skill's instructions conflict with this file, this file wins.

| Task | Lead skill (invoke first) | Supporting | Never |
| --- | --- | --- | --- |
| Bug, failing test, unexpected behaviour | `superpowers:systematic-debugging` | `ponytail:ponytail` for the fix | — |
| New feature or behaviour change | `superpowers:brainstorming` → `superpowers:writing-plans` | `superpowers:test-driven-development` for server logic | `superpowers:using-git-worktrees` / `finishing-a-development-branch` without approval |
| Fix/polish an existing page | `impeccable` (`audit`, `critique`, `polish`, `harden`) | `ui-ux-pro-max:ui-ux-pro-max` (UX/a11y rules) | `frontend-design` |
| New component in the existing style | `ui-ux-pro-max:ui-styling` | `impeccable critique` | `ui-ux-pro-max:design`, `banner-design`, `slides` |
| Approved redesign / new section | `frontend-design:frontend-design` | `impeccable` | — |
| UI verification | built-in browser (desktop + 375px mobile) | `playwright:playwright-cli` once installed | — |
| Code review | built-in `code-review` | `ponytail:ponytail-review` | two reviews of the same diff |
| Repository audit | `ponytail:ponytail-audit` | `security-review` | — |
| Work on `server/aiContentService.ts` LLM payloads | `headroom-skill:headroom` | — | adding deps without approval |
| Before saying "done/fixed/passing" | `superpowers:verification-before-completion` | — | — |

Simple corrections (typo, one-line config, docs) need no process skill; still verify.

Precedence when skills disagree: CLAUDE.md > the user's request > `superpowers` process skills > `ponytail` (code size) > design skills. Design skills must preserve the existing JOAN visual identity unless a redesign is approved. The response format below overrides any skill's reply style.

Restricted tools: `omniroute` (sends content to third-party models) and `graphify` (LLM extraction of file contents) need explicit approval per use and must never receive customer data, `.env` values or database dumps. `graphify-out/` must stay git-ignored. Project memory lives in `docs/` and Claude Code auto-memory; do not also write to MemPalace unless the user chooses it.

Known prerequisites (see `docs/PLUGIN_WORKFLOW.md`): Python 3 for `ui-ux-pro-max` search, `graphify` and `mempalace`; `node` on the Claude app's PATH for `ponytail` hooks; `@playwright/test` for Playwright tests. If a prerequisite is missing, use the fallback in the table and say so. Do not install tools without approval. Re-audit `docs/PLUGIN_WORKFLOW.md` when `ListPlugins` output changes; plugins enabled after a session starts load only in the next session.
```

И в „Response format after each task“ заменете реда за плъгините с:

```markdown
- **Плъгини:** exact `Skill` tool invocations made this task (e.g. `superpowers:systematic-debugging`), plus browser/MCP tools used; for each routing-table skill that applied but was not invoked, one line why.
```

## Допълнително (по избор, изисква одобрение)

- **Project hook** в `.claude/settings.json`: `UserPromptSubmit` hook, който при всяко съобщение напомня таблицата за маршрутизиране. Това е единственият механизъм, който реално гарантира прилагането ѝ.
- ~~Добавяне на `graphify-out/` и `.manus-logs/` в `.gitignore`.~~ Приложено на 2026-11-17.
