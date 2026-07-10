---
name: workspace-task-id
description: Assigns incremental WS-N task identifiers and renames chats to "WS-N - Task Title" in the WhoSaaS workspace. Use at the start of every new task, when the user says "new task", mentions WS-, or opens a fresh chat with an actionable request.
---

# Workspace task identifiers (WS-N)

## When to run

Run this workflow at the **start of every new task** in this workspace:

- First actionable user request in a new chat
- User explicitly says "new task"
- User starts a distinct follow-on task in the same chat (assign a new WS-N only when they clearly mean a separate task)

Do **not** re-assign an ID mid-task or on follow-up messages within the same task.

## Workflow

1. Read `.cursor/skills/workspace-task-id/counter.json`
2. Assign `WS-{next}` (e.g. if `next` is 1, assign `WS-1`)
3. Increment `next` by 1 and write `counter.json` back immediately (before other work)
4. Derive a short **Task Title** from the user's request (5–8 words, title case)
5. Call MCP `rename_chat` with title: `WS-N - Task Title`
6. Prefix the first response line with the identifier: `**WS-N** — …`
7. Reference the ID in commit messages when the user asks to commit (optional prefix: `WS-N:`)

## Task title examples

| User request | Chat title |
|--------------|------------|
| Fix invoice subject on Sunday | `WS-3 - Fix Invoice Subject On Sunday` |
| Add export to CSV | `WS-4 - Add CSV Export` |

## Counter file

Path: `.cursor/skills/workspace-task-id/counter.json`

```json
{ "next": 2 }
```

- `next` is the **next** ID to assign (not the last used)
- Commit counter updates with other workspace changes so IDs stay in sync across machines
- If two chats race, the higher `next` wins; avoid starting duplicate tasks in parallel when possible

## Notes

- IDs are workspace-scoped (WhoSaaS repo), not global across all Cursor projects
- Renaming requires the `cursor-app-control` MCP `rename_chat` tool
