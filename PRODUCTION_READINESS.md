# FlowOps — Production Readiness Report

_Generated 2026-06-26_

## 1. Completed features

| Module | Status |
|---|---|
| Auth (email/password + Google) | ✅ Live |
| Workspaces, roles, invitations | ✅ Live |
| Order management & assignment | ✅ Live |
| Packing scanner with auto-detection | ✅ Live |
| Returns workflow (intake → inspection → resolution) | ✅ Live |
| Reports & exports (XLSX/CSV/PDF) | ✅ Live |
| Operations Intelligence (audit trail, KPIs, charts) | ✅ Live |
| Integration Center (Shopee, TikTok, Tokopedia, Lazada, Blibli stubs + bulk import) | ✅ Live |
| Notification Center + Automation rules | ✅ Live |
| Scheduled reports (daily/weekly/monthly) | ✅ Live (delivery pending email provider) |
| Multi-tenant workspace isolation (RLS) | ✅ Live |
| API tokens, manual backups, workspace export | ✅ Live |
| Subscription plan placeholder | ✅ Live (no billing wired) |
| Marketplace/courier/email providers | 🟡 Architecture ready, integrations pending |

## 2. Architecture overview

- **Frontend**: TanStack Start v1, React 19, Tailwind v4, shadcn/ui.
- **State**: TanStack Query backed by Supabase JS client. SSR-safe loaders use server functions.
- **Server**: `createServerFn` for app-internal RPC (with `requireSupabaseAuth` middleware), TanStack server routes reserved for future webhooks under `/api/public/*`.
- **Database**: Supabase Postgres with RLS. Service-role admin client (`client.server.ts`) used only inside `*.functions.ts` handler bodies (never imported at module top level).
- **Auth**: Supabase Auth (email/password + Google). Protected routes live under `_authenticated/` (`ssr:false`); bearer tokens attached via `attachSupabaseAuth` middleware.
- **i18n**: react-i18next, EN + ID bundled.

## 3. Database overview

Workspace-scoped tables (RLS enforced via `private.current_workspace_id()` or `EXISTS roles` check):

`workspaces, users, roles, profiles, orders, order_items, order_assignments, packing_orders, packing_records, returns, return_items, return_timeline, stores, imports, import_logs, audit_logs, automation_rules, scheduled_reports, notifications, detection_rules, reports, api_tokens, backup_runs, invitations`

User-scoped tables: `notifications` (read/update/delete only your own rows).

Storage buckets: `workspace-logos` (private), `return-photos` (private).

## 4. Security status

- ✅ RLS enabled on every public table; explicit GRANTs to `authenticated` and `service_role`.
- ✅ Roles stored in dedicated `roles` table, never on profile — prevents privilege escalation.
- ✅ Role checks via `public.has_role` / `private.is_workspace_owner` (SECURITY DEFINER, derive from `auth.uid()` only).
- ✅ `private.current_workspace_id()` derives workspace from `auth.uid()` — not from a client-settable GUC.
- ✅ Service-role key never exposed to client; admin client loaded with dynamic `await import` inside server-function handlers.
- ✅ API tokens stored as `sha256(token)`; raw value revealed once at creation.
- ✅ Audit log captures actor, IP, user agent, action, target, metadata.
- ⚠️ Email provider not wired yet — scheduled reports and password-reset emails sit in the queue until configured.

## 5. Performance notes

- Dashboard and Operations queries use server-side aggregates with `count: "exact"` head requests instead of full row pulls.
- Reports use the Query cache (5-minute stale) and dedicated server fns; large exports stream to the browser via `Blob` URLs.
- Scanner uses indexed lookups on `tracking_number` and `order_number`; duplicate scans short-circuit on `23505`.
- Notifications poll every 30 s (cheap `HEAD count` query) and lazy-load the full list on popover open.
- Indexes added: `notifications(user_id, read_at, created_at desc)`, `notifications(workspace_id, created_at desc)`.

## 6. Future roadmap (architecture-ready, not implemented)

- Marketplace API sync (Shopee / TikTok / Tokopedia / Lazada / Blibli) — Integration Center.
- Email/WhatsApp/Slack/Teams/Discord/Push delivery channels — Automation Channels tab.
- AI insights and predictive analytics — Operations module.
- OCR / label recognition — Detection rules engine.
- Payment-driven plan changes — `workspaces.plan` placeholder.
- Cloud-managed backups — `backup_runs` table + manual JSON export already in place.

## 7. Deployment checklist

- [x] All TypeScript builds clean (`tsgo --noEmit` green).
- [x] All migrations applied and idempotent.
- [x] No `console.log` of secrets or PII in code.
- [x] Secrets (`SUPABASE_*`, `LOVABLE_API_KEY`) provisioned in Lovable Cloud.
- [x] Auth providers reviewed — email/password + Google enabled by default.
- [ ] Connect an email provider before relying on password-reset, invitation, or scheduled-report emails in production.
- [ ] Enable Have-I-Been-Pwned password check in Cloud → Users → Auth Settings before public launch.
- [ ] Click **Publish** to push frontend changes; backend (server fns, migrations) deploy automatically.
- [ ] Optional: attach a custom domain from Project Settings → Domains.
