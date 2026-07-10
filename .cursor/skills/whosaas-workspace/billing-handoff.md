# Billing feature handoff

Source chat: [Billing weekly submissions](9ecb2074-a4f4-4178-adce-e73c08a4e2bf) (Apr 27 – Jul 2, 2026).

## Product summary

Weekly invoice submission for contractors/team members. Billing weeks run **Saturday through Friday** in **America/New_York**. Users submit invoice documents through the portal; the system emails configured company recipients, tracks history, prevents duplicate weekly submissions, and allows admin resubmission requests.

## Routes

| Audience | Route |
|----------|-------|
| Users | `/billing` → redirects to `/billing/invoicing` |
| Users | `/billing/user-settings` |
| Admins | `/admin/billing/settings` |
| Admins | `/admin/billing/submissions` |

## Stack choices

- **Email:** Resend (`src/lib/services/billing/email.ts`, `src/lib/services/email/resend.ts`)
- **File storage:** Vercel Blob private (`src/lib/services/storage/blob.ts`)
- **Allowed file types:** PDF, DOCX, XLSX, CSV (10MB per file, multiple files per submission)

## Data model

Tables in `src/lib/db/schema.ts`:

- `billing_settings` — TO/CC recipients, footer, instructions, overdue banner config
- `billing_periods` — Sat–Fri period bounds per company
- `billing_submissions` — status, subject, body, email delivery, admin notes, attempt number
- `billing_submission_files` — uploaded file metadata and storage paths

Statuses: `submitted`, `accepted`, `needs_resubmission`, `failed`. Email status: `pending`, `sent`, `failed`.

## Key services

| File | Role |
|------|------|
| `src/lib/services/billing/period.ts` | Week bounds, labels, Sun/Mon default period logic |
| `src/lib/services/billing/submissions.ts` | Submit orchestration, current state, admin actions |
| `src/lib/services/billing/invoice.ts` | Subject generation, invoice line items |
| `src/lib/services/billing/invoice-pdf.ts` | PDF generation |
| `src/lib/services/billing/email.ts` | Outbound submission email |
| `src/lib/services/billing/auth.ts` | Permission helpers |
| `src/lib/validation/billing.ts` | Zod schemas, timezone constant |

## Subject format

Auto-generated, not user-editable:

```
[User Name] - Billing Submission for [Saturday date] to [Friday date]
```

Example: `Bryan Spano - Billing Submission for April 25, 2026 to May 1, 2026`

## Submission rules

- One submission per billing week unless admin marks **Needs Resubmission**
- Append-only attempt history (resubmission attempt 1, 2, etc.)
- At least one TO recipient required before send
- Backend enforces all permission rules (standard user, company admin, super admin)

## APIs

- `GET /api/billing/current` — current period, status, warnings, canSubmit
- `POST /api/billing/submissions` — create submission with files
- `GET /api/billing/history` — user's submission history
- `GET/PUT /api/admin/billing/settings` — recipient management
- `GET /api/admin/billing/submissions` — admin list with filters
- `PATCH /api/admin/billing/submissions/:id/status` — accept or request resubmission
- `GET /api/admin/billing/submissions/:id/files/:fileId` — secure download

## Follow-on work from Billing chat (deployed)

All on branch `cursor/workspace-scoped-company-filters`, production at whosaas.com:

| Item | Files |
|------|-------|
| Invoice number auto-suggest | invoicing UI + submissions service |
| Stay on `/time` after save | `src/components/time/quick-entry-form.tsx` |
| Workday actions in top nav | `workday-header-actions.tsx`, slimmed `team-status-panel.tsx` |
| Timesheet Task column | `timesheet/page.tsx`, `timesheet-client.tsx` |
| Sun/Mon default billing period | `period.ts`, `submissions.ts`, `invoicing-page-client.tsx` (commit `c0d0a13`) |

## Sun/Mon billing period fix (important)

**Bug:** On Sunday/Monday, the billing period dropdown defaulted to the new in-progress week (index 0) while users could edit the first line item to the prior week. Email subject and preview used the dropdown, so they mismatched.

**Fix:**

- `isSundayOrMondayInBillingTz()` — detects Sun/Mon in ET
- `getDefaultBillingPeriodBounds()` — Sun/Mon → prior completed Sat–Fri week; other days → current week
- `resolveDefaultBillingPeriodState()` — picks default period by bounds, not always index 0
- First line item in `invoicing-page-client.tsx` always syncs when `selectedPeriod.id` changes

## Optional follow-ups (not done)

- Merge `cursor/workspace-scoped-company-filters` → `main`
- Show task names on **admin timesheet detail** (user weekly timesheet only was updated)
- Cosmetic polish (workday button icons, etc.)

## Future enhancements (designed for, not built)

Invoice OCR, amount validation, payroll export, QuickBooks, Stripe payouts, reminder emails, Teams/Slack reminders, monthly summaries, company-specific billing schedules.
