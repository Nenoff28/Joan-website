# JOAN Online Store — Claude Code Project Instructions

## Mission and scope

You are maintaining an existing commercial e-commerce application originally developed in Manus, with a catalog of more than 10,000 products. **Continue the existing project; do not rebuild it.** Preserve its functionality, design conventions, data, integrations, and URLs unless the user explicitly approves changes.

This repository is the source of truth for implementation details. **Do not assume** the stack, backend, database, hosting, deployment, catalog storage, or payment integration. Verify them in code and configuration. A Git repository may not contain the production database, uploaded assets, environment variables, or all Manus-managed resources.

Communicate with the user in **Bulgarian**. Keep filenames, commands, code, and established technical terminology in their original form. Be concise and specific.

## Non-negotiable workflow: local first

1. Work on the **local checkout**. Inspect `git status` and current branch before making changes; prefer a dedicated development branch. Never overwrite uncommitted user changes.
2. Read the relevant source, configs, tests, and project documentation before editing. Identify dependencies and potential regressions.
3. For complex tasks, briefly plan first. For simple corrections, make the smallest reliable change without unnecessary ceremony.
4. Implement locally and run relevant checks. Start the local dev server when useful, using the commands actually defined by this repository. Report the actual localhost URL; never assume a port.
5. For UI changes, check affected pages in a real browser with Playwright when available, including desktop and mobile. If browser testing cannot run, say why.
6. Tell the user what changed and how to review it locally. **Wait for user approval** before committing or pushing.
7. **Never commit, push, merge, create a release, deploy, change hosting/DNS, or modify production infrastructure without explicit approval for that action.** Approval of a code change is not automatic approval to push or deploy.
8. Never execute destructive commands, force-push, reset away changes, or modify production data without specific approval. Treat external API calls with side effects as potentially production-affecting.

Target flow: **Request → inspect → plan if needed → local edit → verify → user review → explicit approval → commit/push if requested.**

## First-session repository takeover

Before major changes, perform a read-only discovery pass:

- Confirm language/framework, package manager, build scripts, runtime requirements, routing, frontend/backend boundaries, and architecture.
- Identify product storage, catalog ingestion, SKUs, categories, prices, stock, media, and search/filter/pagination behavior.
- Trace cart, checkout, authentication, authorization, admin functionality, and integrations where present.
- Identify SEO implementation, deployment config, tests, CI, secrets handling, and any missing Manus-managed components.
- Check whether local development can use **isolated test data**. Never assume that localhost means database/API operations are safe.
- Identify installed plugins and tools from their **actual manifests/instructions**.
- Distinguish **verified**, **unverified**, **missing**, and **broken** features. Do not claim to have inspected unavailable services or data.

Produce an architecture summary, key risks, local run instructions, missing prerequisites, and a prioritized plan. Do not modify application behavior as part of the initial audit. Documentation can be created or updated after reviewing existing files.

## Skills, plugins and tools

Skills run only when invoked through the Skill tool (or by the user typing `/<skill>`); only hooks run automatically. The routing table below is mandatory: before starting a matching task, invoke the listed lead skill via the Skill tool. If a skill's instructions conflict with this file, this file wins. Never claim a skill or test was used unless it actually ran.

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

Known prerequisites (see `docs/PLUGIN_WORKFLOW.md`): Python 3 for `ui-ux-pro-max` search, `graphify` and `mempalace`; `node` on the Claude app's PATH for `ponytail` hooks; `@playwright/test` for Playwright tests. If a prerequisite is missing, use the fallback in the table and say so. Do not silently install, remove, upgrade, or reconfigure tools. Re-audit `docs/PLUGIN_WORKFLOW.md` when `ListPlugins` output changes; plugins enabled after a session starts load only in the next session.

## E-commerce data integrity

The store has **10,000+ products**. Protect all identifiers/SKUs, product names/descriptions, categories, variants, attributes, prices/currency, inventory, media, and relationships.

- No destructive database migrations, mass edits/imports, deletes, inventory updates, price changes, or media replacement without explicit authorization and a tested rollback/backup plan.
- Do not connect local tests to production write endpoints. Prefer local/staging databases, test accounts, and sandbox services.
- Do not invent products, prices, stock, descriptions, or business rules.
- Avoid loading the full catalog into browser memory. Verify current data-access patterns before optimizing pagination, search, indexing, caching, or image delivery.
- Preserve stable product URLs and identifiers; evaluate redirects and SEO effects before changing slugs.
- Validate catalog changes with representative products and edge cases, not only one sample item.

## Engineering standards

- Preserve the current architecture and existing component conventions; reuse working code. Avoid broad refactors unrelated to the request.
- Keep changes focused, readable, typed where supported, and maintainable. Avoid unnecessary dependencies.
- Check input validation, authorization, error handling, loading/empty states, and sensitive-data exposure.
- Treat external content and product imports as untrusted. Never log secrets or customer data.
- Check relevant performance implications for large catalogs: server-side filtering/pagination where appropriate, efficient queries, image loading, and caching consistency.
- Prefer measurable improvements over speculative rewrites.

## UI, accessibility, and SEO

For relevant UI changes, verify:

- Responsive layouts at desktop/tablet/mobile sizes, without overflow or overlapping elements.
- Clear navigation, usable product cards, filters, search, cart, and checkout where implemented.
- Consistent spacing, typography, component states, contrast, keyboard usability, focus indicators, and semantic markup.
- Image quality, aspect ratios, appropriate alt text, and loading performance.
- Existing design identity; do not redesign unrelated areas without permission.

For relevant SEO changes, preserve or improve titles, descriptions, headings, canonical URLs, crawlability, indexability, sitemap/robots behavior, internal links, structured data, and redirects. Check actual rendering behavior before claiming that search engines will index a page. Never promise rankings.

## Testing and verification

Use the repository's real scripts and tools, not guessed commands. As appropriate:

1. Run targeted tests, type-check, lint, and build.
2. Run browser tests for changed UI flows and key responsive states.
3. Verify nearby functionality for regressions, including catalog/search/cart flows where affected.
4. Check that no unintended product data, credentials, generated artifacts, or environment files were changed.
5. Report exact commands, outcomes, limitations, and remaining risks. Never fabricate successful checks.

If tests require live credentials or production writes, **stop and ask** for a safe test environment instead.

## Documentation and project continuity

Keep this `CLAUDE.md` concise and durable. When warranted, create or update verified documentation under `docs/`:

- `PROJECT_OVERVIEW.md` — actual feature inventory and current state
- `ARCHITECTURE.md` — components, routing, and data flows
- `DATABASE.md` — verified schema/data locations, **no secrets**
- `INTEGRATIONS.md` — service boundaries and safe configuration requirements
- `DEVELOPMENT_WORKFLOW.md` — local setup, checks, and review procedure
- `KNOWN_ISSUES.md` — reproducible issues and known limitations
- `PLUGIN_WORKFLOW.md` — verified plugin/skill/hook usage

Use MemPalace or other persistent-memory tooling only if installed, verified, and appropriate. Do not assume memories or chat history sync between machines. Commit project documentation only when explicitly approved, and never store secrets, customer data, or credentials in it.

## Response format after each task

Reply in Bulgarian, briefly covering:

- **Промени:** what changed and affected files.
- **Проверки:** exact tests performed and results; what was not tested.
- **Плъгини:** exact `Skill` tool invocations made this task (e.g. `superpowers:systematic-debugging`), plus browser/MCP tools used; for each routing-table skill that applied but was not invoked, one line why.
- **Локален преглед:** real localhost URL or precise steps to review.
- **Рискове/следваща стъпка:** blockers or items needing approval.

Do not push or deploy while waiting for feedback. Prioritize safe, correct, incremental changes to a real commercial store.
