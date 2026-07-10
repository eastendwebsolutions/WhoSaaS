# WhoSaaS agent workflows

Step-by-step flows from recurring patterns in prior chats. Read the section that matches the current task.

## New feature from spec

1. Read [project-context.md](project-context.md) and relevant domain handoff (e.g. billing-handoff.md)
2. Explore codebase: schema, RBAC, similar features, API route conventions
3. If architecture choice materially affects design (email provider, storage, etc.), ask 1–2 questions via AskQuestion
4. CreatePlan with concrete file paths and sequence
5. Wait for user approval unless they said "implement" immediately
6. On **"Implement the plan…"**: do not edit plan file; use existing todos; mark `in_progress` → complete all
7. `npm run build` / targeted `npm test` before ship
8. Commit and deploy per [auto-commit-deploy rule](../../rules/auto-commit-deploy.mdc)

## Bug on production

1. Reproduce or read user screenshot / error message
2. `npx vercel logs whosaas.com` (filter for route or error class)
3. Identify root cause (often env validation, Zod, missing optional field)
4. Minimal fix matching existing patterns
5. Add unit test if rule is non-obvious and testable in isolation
6. `npm run build` and relevant tests
7. Commit, push, deploy; report commit hash and what was fixed

## Commit push deploy

When user says `commit`, `push`, or `commit push deploy`:

1. `git status`, `git diff`, `git log -3 --oneline` (parallel)
2. Stage **only** files relevant to the task
3. Commit via HEREDOC; prefix `WS-N:` if task ID was assigned
4. `git push` only if user asked for push or "commit push deploy"
5. `npx vercel --prod --yes` only if user asked for deploy or auto-commit rule applies
6. `npm run db:push` if new Drizzle migrations exist
7. Report commit hash, branch, production URL

Do not force-push main/master. Do not amend unless user requested and amend rules are satisfied.

## Additive UI move

Example: workday actions from dashboard to header.

1. Confirm constraint: **no API or business-rule changes**
2. Extract shared hook/logic from existing component
3. New header component; single import swap in `app-header.tsx`
4. Remove duplicate UI from old location only
5. Regression checklist: nav links, other pages, mobile layout, same confirm/API flow
6. `npm run build`
7. Ship per commit/deploy rules

## Ingest prior chat

1. Open [chat-archive-index.md](chat-archive-index.md)
2. Read transcript at `~/.cursor/projects/Users-bryanspano-Cursor-WhoSaaS/agent-transcripts/{uuid}/{uuid}.jsonl`
3. Summarize decisions, shipped commits, and open items
4. For billing work, prefer [billing-handoff.md](billing-handoff.md) over re-reading full transcript

## Plan-only mode

When in plan mode:

- Research read-only; no edits or commits
- Use CreatePlan; do not edit plan file after user attaches it
- Ask 1–2 critical questions if implementation fork is unclear
- Cite specific file paths in the plan

## Teams / Resend troubleshooting

1. Confirm channel email saved (`destinationConfigured`, green masked hint in UI)
2. Test send returns Resend id → check Resend dashboard for Delivered vs Bounced
3. If Resend Delivered but Teams Posts empty: Microsoft tenant/channel policy ("Anyone can send emails to this address")
4. Recommend workflow webhook if email path blocked
