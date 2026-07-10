---
name: whosaas-workspace
description: WhoSaaS product and workspace context for the eastendwebsolutions/WhoSaaS repo. Use for WhoSaaS development, billing/invoicing work, continuing prior Billing chat work, or any task in this workspace.
---

# WhoSaaS workspace

## Product

**WhoSaaS** — Asana-first multi-tenant time tracking SaaS.

- **Production:** [https://whosaas.com](https://whosaas.com)
- **Local folder:** `~/Cursor/WhoSaaS`
- **Git remote:** `https://github.com/eastendwebsolutions/WhoSaaS.git`
- **Stack:** Next.js 16, Clerk auth, Drizzle ORM, PostgreSQL (Neon/Vercel Postgres), Vercel deploy

## Active branch note

Much recent work (billing, workday header, timesheet task column, Sun/Mon invoice fix) lives on `cursor/workspace-scoped-company-filters`. Check `git branch` before assuming `main` has everything.

## Task identifiers

Every new task gets a `WS-N` ID via the [workspace-task-id](../workspace-task-id/SKILL.md) skill. Chat titles follow `WS-N - Task Title`.

## Chat history

All SAASTimeTrack and WhoSaaS agent transcripts are merged under:

`~/.cursor/projects/Users-bryanspano-Cursor-WhoSaaS/agent-transcripts/`

See [chat-archive-index.md](chat-archive-index.md) for the full list with titles and archive status.

## Billing / invoicing

For billing feature context, submission rules, API map, and follow-on work from the original Billing chat, read [billing-handoff.md](billing-handoff.md).

Quick pointers:

- User invoicing: `/billing/invoicing`
- Admin settings: `/admin/billing/settings`
- Admin submissions: `/admin/billing/submissions`
- Billing weeks: Sat–Fri, America/New_York

## Deploy

After code changes (unless user says local only):

```bash
npm run deploy:vercel
```

If schema migrations changed: `npm run db:push` against production.

## Next.js note

This project uses Next.js 16 with breaking changes from older versions. Check `node_modules/next/dist/docs/` before assuming standard Next.js patterns.
