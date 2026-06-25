# Sprint 3 — Automation & Barcode Intelligence

## What's included

| File | What it does |
|---|---|
| `supabase/migrations/20260626000001_sprint3_automation_rules.sql` | Creates `automation_rules` + `workspace_preferences` tables with RLS |
| `src/lib/use-automation-rules.ts` | All hooks (CRUD for rules, prefs) + `evaluateRules()` engine |
| `src/routes/_app.automation.tsx` | New Automation Rules management page (`/automation`) |
| `src/routes/_app.scanning.tsx` | **Replaces** existing scanning route — adds rule evaluation + USB scanner |
| `src/routes/_app.settings.tsx` | **Replaces** existing settings route — notification prefs now persist to DB |
| `src/components/app-sidebar.tsx` | **Replaces** existing sidebar — adds Automation link under Workspace group |

---

## Installation steps

### 1. Run the Supabase migration

```bash
supabase migration up
```

Or paste the SQL directly into Supabase Studio → SQL Editor if you're using the hosted dashboard.

### 2. Copy files into your project

```
cp -r sprint3/supabase/migrations/20260626000001_sprint3_automation_rules.sql \
      your-project/supabase/migrations/

cp sprint3/src/lib/use-automation-rules.ts \
   your-project/src/lib/

cp sprint3/src/routes/_app.automation.tsx \
   your-project/src/routes/

# These replace existing files:
cp sprint3/src/routes/_app.scanning.tsx \
   your-project/src/routes/

cp sprint3/src/routes/_app.settings.tsx \
   your-project/src/routes/

cp sprint3/src/components/app-sidebar.tsx \
   your-project/src/components/
```

### 3. Start dev server (generates the route automatically)

```bash
bun dev
```

TanStack Router will detect `_app.automation.tsx` and update `routeTree.gen.ts`
on its own. You do **not** need to edit `routeTree.gen.ts` manually.

---

## How automation rules work

1. Owner goes to **Settings → Manage rules** (or directly to `/automation`)
2. Creates rules like: `raw_code starts_with "SPX" → Marketplace: Shopee, Courier: SPX Express`
3. Rules are stored in Supabase with priority order
4. On every scan (typing or USB scanner), the barcode is tested against rules top-to-bottom
5. First match auto-fills Marketplace and Courier dropdowns — shown with an "auto" badge
6. The matched rule name is logged in `audit_logs.metadata.auto_rule`

## USB/Bluetooth scanner support

Hardware scanners are now intercepted at the `window` level. They work by
sending characters extremely fast (< 80 ms apart) and then `Enter`. The
scanning page detects this pattern and submits automatically — no button click
needed. Manual keyboard typing still works normally.

## Notification preferences

Settings → Notifications toggles now save to the `workspace_preferences` table
and persist across sessions. Previously they reset on every page load.
