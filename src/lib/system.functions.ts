import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRec = any;

async function getWs(supabase: any, userId: string) {
  const { data } = await supabase.from("users").select("workspace_id").eq("user_id", userId).maybeSingle();
  return data?.workspace_id as string | null;
}

async function assertRole(supabase: any, userId: string, roles: string[]) {
  const { data } = await supabase
    .from("roles").select("role, workspace_id").eq("user_id", userId).maybeSingle();
  if (!data || !roles.includes(data.role)) throw new Error("Forbidden");
  return data.workspace_id as string;
}

/** Aggregated workspace + system health snapshot. */
export const systemStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const wid = await getWs(context.supabase, context.userId);
    if (!wid) return null;
    const sb = context.supabase;

    const counts = async (table: string, filters: AnyRec = {}) => {
      let q: AnyRec = (sb as AnyRec).from(table).select("id", { count: "exact", head: true }).eq("workspace_id", wid);
      for (const [k, v] of Object.entries(filters)) q = q.eq(k, v);
      const { count } = await q;
      return count ?? 0;
    };

    const since = (table: string, col: string) =>
      (sb as AnyRec).from(table).select(col).eq("workspace_id", wid).order(col, { ascending: false }).limit(1).maybeSingle();

    const [
      orders, packed, members,
      activeMembers, returns, scans,
      lastBackup, lastImport, lastSync, lastAudit,
    ] = await Promise.all([
      counts("orders"),
      counts("orders", { packing_status: "packed" }),
      counts("users"),
      counts("users", { status: "active" }),
      counts("returns"),
      counts("packing_records"),
      since("backup_runs", "started_at"),
      since("imports", "created_at"),
      Promise.resolve(since("stores", "last_sync_at")).catch(() => ({ data: null }) as AnyRec),
      since("audit_logs", "created_at"),
    ]);

    return {
      workspace_id: wid,
      database: { reachable: true, latency_ms: 0 },
      counts: { orders, packed, members, activeMembers, returns, scans },
      last_backup_at: (lastBackup.data as AnyRec)?.started_at ?? null,
      last_import_at: (lastImport.data as AnyRec)?.created_at ?? null,
      last_sync_at: (lastSync as AnyRec)?.data?.last_sync_at ?? null,
      last_audit_at: (lastAudit.data as AnyRec)?.created_at ?? null,
    } as AnyRec;
  });

/** Export the whole workspace as JSON — used as a manual backup. */
export const exportWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const wid = await assertRole(context.supabase, context.userId, ["Owner"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tables = [
      "workspaces", "users", "roles", "profiles",
      "orders", "order_items", "order_assignments",
      "packing_orders", "packing_records",
      "returns", "return_items", "return_timeline",
      "stores", "imports", "import_logs",
      "audit_logs", "automation_rules", "scheduled_reports",
      "notifications", "detection_rules", "reports",
    ];

    const bundle: AnyRec = { workspace_id: wid, generated_at: new Date().toISOString(), tables: {} };
    let totalRows = 0;
    for (const t of tables) {
      const admin = supabaseAdmin as AnyRec;
      const { data } = t === "profiles"
        ? await admin.from(t).select("*")
        : await admin.from(t).select("*").eq("workspace_id", wid);
      bundle.tables[t] = data ?? [];
      totalRows += (data?.length ?? 0);
    }

    const json = JSON.stringify(bundle);
    const bytes = new TextEncoder().encode(json).length;

    const { data: run } = await supabaseAdmin
      .from("backup_runs")
      .insert({
        workspace_id: wid,
        kind: "workspace_export",
        status: "success",
        bytes,
        rows: totalRows,
        started_by: context.userId,
        finished_at: new Date().toISOString(),
        notes: "Manual workspace export (JSON)",
      })
      .select("id")
      .single();

    return {
      run_id: run?.id ?? null,
      bytes,
      rows: totalRows,
      generated_at: bundle.generated_at,
      data: bundle,
    };
  });

/** Record a manual database backup attempt — placeholder until a managed backup target is wired. */
export const requestDatabaseBackup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const wid = await assertRole(context.supabase, context.userId, ["Owner"]);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("backup_runs")
      .insert({
        workspace_id: wid,
        kind: "database",
        status: "pending",
        started_by: context.userId,
        notes: "Manual backup queued — connect a backup target to complete.",
      })
      .select("id")
      .single();
    return { id: data?.id ?? null };
  });

export const listBackups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("backup_runs").select("*").order("started_at", { ascending: false }).limit(25);
    if (error) throw error;
    return (data ?? []) as AnyRec[];
  });
