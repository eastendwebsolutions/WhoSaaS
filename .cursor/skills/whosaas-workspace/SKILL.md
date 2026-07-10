---
name: whosaas-workspace
description: WhoSaaS master agent playbook. Use at the start of EVERY task in this workspace. Assigns WS-N task IDs, applies implementation, commit, deploy, and debug norms, and links project plus domain context from prior agent chats.
---

# WhoSaaS agent playbook

Read this skill at the **start of every new task** in this workspace. For step-by-step flows, see [workflows.md](workflows.md).

## Task startup (mandatory)

Run at the first actionable request in a new chat, when the user says "new task", or when they start a clearly separate follow-on task.

1. Read `.cursor/skills/workspace-task-id/counter.json`
2. Assign `WS-{next}` (e.g. if `next` is 2, assign `WS-2`)
3. Increment `next` by 1 and write `counter.json` back immediately
4. Derive a short **Task Title** from the request (5–8 words, title case)
5. Call MCP `rename_chat` with title: `WS-N - Task Title`
6. Prefix the first response line with: `**WS-N** — …`
7. Optional commit prefix when user asks to commit: `WS-N:`

Do **not** re-assign an ID on follow-up messages within the same task.

## Every-task checklist

- Check `git branch` and `git status` (much work is on `cursor/workspace-scoped-company-filters`, not `main`)
- Read [project-context.md](project-context.md) if unfamiliar with the area
- Read [billing-handoff.md](billing-handoff.md) for billing, invoicing, or billing-period bugs
- Read [chat-archive-index.md](chat-archive-index.md) when continuing work from a prior chat
- Read `node_modules/next/dist/docs/` before assuming standard Next.js patterns ([AGENTS.md](../../../AGENTS.md))

## Product snapshot

**WhoSaaS** — Asana-first multi-tenant time tracking at [https://whosaas.com](https://whosaas.com).

| Item | Value |
|------|-------|
| Local folder | `~/Cursor/WhoSaaS` |
| Git remote | `https://github.com/eastendwebsolutions/WhoSaaS.git` |
| Stack | Next.js 16, Clerk, Drizzle, PostgreSQL, Vercel |
| Transcripts | `~/.cursor/projects/Users-bryanspano-Cursor-WhoSaaS/agent-transcripts/` |

Full route map, roles, and open issues: [project-context.md](project-context.md).

## Implementation norms

- **Minimal scope**: smallest correct diff; no drive-by refactors
- **Match existing code**: read surrounding files; reuse services and patterns
- **Additive-only** when user requests UI relocation: no API or business-rule changes unless asked
- **Backend enforces RBAC**: never rely on frontend hiding alone (`user`, `company_admin`, `super_admin`)
- **Multi-tenant**: respect `company_id` scoping; workspace dropdown is UI grouping, not a security boundary replacement
- **Tests**: add focused unit tests for non-obvious business rules (billing periods, env parsing, Teams email validation)
- **Optional email env vars**: invalid values must not 500 the app (`parseOptionalEmailEnv` pattern in `src/lib/env.ts`)

## Plan → implement

- Large features: explore codebase, ask 1–2 architecture questions if choices materially change design, then plan; implement after user approval
- When user says **"Implement the plan…"**:
  - Do **not** edit the plan file
  - Use **existing todos** (do not recreate)
  - Mark first todo `in_progress`, complete all before stopping
- When user says **"additive only"**: list unchanged areas explicitly; regression-check them

## Commit / push / deploy

Follow [`.cursor/rules/auto-commit-deploy.mdc`](../../rules/auto-commit-deploy.mdc) unless the user opts out ("local only", "don't commit", "no deploy").

| User says | Action |
|-----------|--------|
| (after code changes, default) | commit → `npm run deploy:vercel` |
| `commit` | commit only |
| `push` | push only |
| `commit push deploy` | commit, push, deploy in sequence |

After deploy: report commit hash and [https://whosaas.com](https://whosaas.com). If Drizzle migrations changed: `npm run db:push` against production before or immediately after deploy.

Detailed git steps: [workflows.md](workflows.md#commit-push-deploy).

## Production debugging

- For live bugs: run `npx vercel logs whosaas.com` before guessing
- Verify locally with `npm run build` and `npm test` when relevant
- Email / Teams: distinguish **Resend accepted** (app OK) vs **Microsoft delivered** (check Resend dashboard by message id)
- Teams channel emails ending in `@amer.teams.ms` are valid; save can succeed even when Enable is off if Resend is not ready

## Communication (Bryan voice)

- First person **I**, not we
- No em dashes as punctuation between clauses
- After local work is done but not shipped: say **commit push deploy** if auto-commit rule does not apply, or ship per rule

## Reference files

| File | When to read |
|------|----------------|
| [project-context.md](project-context.md) | Routes, roles, feature map, schema areas, open issues |
| [workflows.md](workflows.md) | Step-by-step for new features, prod bugs, git ship, additive UI |
| [billing-handoff.md](billing-handoff.md) | Billing/invoicing domain, APIs, Sun/Mon period fix |
| [chat-archive-index.md](chat-archive-index.md) | Prior chat transcripts by title and domain |
