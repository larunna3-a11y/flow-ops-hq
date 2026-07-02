import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getConnector } from "@/lib/connectors/marketplaces";
import type {
  ConnectorErrorType,
  SyncTrigger,
} from "@/lib/connectors/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = any;

async function getWorkspaceId(supabase: AnyDb, userId: string): Promise<string> {
  const { data } = await supabase.from("users").select("workspace_id").eq("user_id", userId).maybeSingle();
  if (!data?.workspace_id) throw new Error("No workspace");
  return data.workspace_id as string;
}

async function assertOwner(supabase: AnyDb, userId: string, workspaceId: string) {
  const { data } = await supabase
    .from("roles")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (data?.role !== "Owner") throw new Error("Forbidden: Owner only");
}

async function logError(
  supabase: AnyDb,
  payload: {
    workspaceId: string;
    connectionId?: string | null;
    syncRunId?: string | null;
    connectorKey: string;
    type: ConnectorErrorType;
    message: string;
    context?: Record<string, any>;
  },
) {
  await supabase.from("connector_error_logs").insert({
    workspace_id: payload.workspaceId,
    connection_id: payload.connectionId ?? null,
    sync_run_id: payload.syncRunId ?? null,
    connector_key: payload.connectorKey,
    error_type: payload.type,
    message: payload.message,
    context: payload.context ?? {},
  });
}

// ───────────────────────── Registry ─────────────────────────
export const listAvailableConnectors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.from("connectors").select("*").order("name");
    if (error) throw error;
    return data ?? [];
  });

// ─────────────────────── Connections CRUD ───────────────────
// Non-secret columns exposed to clients. `credentials` and `oauth_tokens`
// are intentionally excluded — those live server-side only and are read
// via the admin client inside protected handlers below.
const CONNECTION_SAFE_COLUMNS =
  "id, workspace_id, connector_key, display_name, store_id, connection_status, auto_sync, sync_interval_minutes, last_sync_at, last_sync_status, last_error, last_error_at, created_by, created_at, updated_at";

export const listConnections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("connector_connections")
      .select(CONNECTION_SAFE_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  });

export const createConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    connectorKey: string;
    displayName: string;
    storeId?: string | null;
    credentials?: Record<string, any>;
    autoSync?: boolean;
    syncIntervalMinutes?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const wid = await getWorkspaceId(context.supabase, context.userId);
    await assertOwner(context.supabase, context.userId, wid);
    if (!getConnector(data.connectorKey)) throw new Error("Unknown connector");

    const { data: row, error } = await context.supabase
      .from("connector_connections")
      .insert({
        workspace_id: wid,
        connector_key: data.connectorKey,
        display_name: data.displayName,
        store_id: data.storeId ?? null,
        credentials: data.credentials ?? {},
        auto_sync: data.autoSync ?? false,
        sync_interval_minutes: data.syncIntervalMinutes ?? 30,
        connection_status: "disconnected",
        created_by: context.userId,
      })
      .select(CONNECTION_SAFE_COLUMNS)
      .single();
    if (error) throw error;
    return row;
  });

export const updateConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    displayName?: string;
    credentials?: Record<string, any>;
    autoSync?: boolean;
    syncIntervalMinutes?: number;
  }) => d)
  .handler(async ({ data, context }) => {
    const wid = await getWorkspaceId(context.supabase, context.userId);
    await assertOwner(context.supabase, context.userId, wid);
    const patch: Record<string, any> = {};
    if (data.displayName !== undefined) patch.display_name = data.displayName;
    if (data.credentials !== undefined) patch.credentials = data.credentials;
    if (data.autoSync !== undefined) patch.auto_sync = data.autoSync;
    if (data.syncIntervalMinutes !== undefined) patch.sync_interval_minutes = data.syncIntervalMinutes;
    const { error } = await context.supabase.from("connector_connections").update(patch as never).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const wid = await getWorkspaceId(context.supabase, context.userId);
    await assertOwner(context.supabase, context.userId, wid);
    const { error } = await context.supabase.from("connector_connections").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// ─────────────────────── Connect / Authenticate / Disconnect ───────
// Loads a connection row INCLUDING secret columns. Uses the service-role
// client because `credentials` / `oauth_tokens` SELECTs are revoked from
// the `authenticated` role. Callers must have already asserted Owner
// membership for the current workspace.
async function loadConnection(id: string, workspaceId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("connector_connections")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (error) throw error;
  return data;
}

export const connectConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const wid = await getWorkspaceId(context.supabase, context.userId);
    await assertOwner(context.supabase, context.userId, wid);
    const row = await loadConnection(data.id, wid);
    const connector = getConnector(row.connector_key);
    if (!connector) throw new Error("Unknown connector");

    const res = await connector.connect({
      connectionId: row.id,
      workspaceId: row.workspace_id,
      connectorKey: row.connector_key,
      credentials: (row.credentials as Record<string, unknown>) ?? {},
      oauthTokens: (row.oauth_tokens as Record<string, unknown>) ?? {},
    });

    await context.supabase.from("connector_connections").update({
      connection_status: res.status,
      oauth_tokens: res.tokens ?? row.oauth_tokens ?? {},
      last_error: res.error?.message ?? null,
      last_error_at: res.error ? new Date().toISOString() : null,
    }).eq("id", row.id);

    if (res.error) {
      await logError(context.supabase, {
        workspaceId: wid, connectionId: row.id, connectorKey: row.connector_key,
        type: res.error.type, message: res.error.message,
      });
    }
    return res;
  });

export const disconnectConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const wid = await getWorkspaceId(context.supabase, context.userId);
    await assertOwner(context.supabase, context.userId, wid);
    const row = await loadConnection(data.id, wid);
    const connector = getConnector(row.connector_key);
    if (connector) {
      await connector.disconnect({
        connectionId: row.id,
        workspaceId: row.workspace_id,
        connectorKey: row.connector_key,
        credentials: (row.credentials as Record<string, unknown>) ?? {},
        oauthTokens: (row.oauth_tokens as Record<string, unknown>) ?? {},
      });
    }
    await context.supabase.from("connector_connections").update({
      connection_status: "disconnected",
      oauth_tokens: {},
    }).eq("id", row.id);
    return { ok: true };
  });

// ─────────────────────── Sync ───────────────────────
export const runSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; trigger?: SyncTrigger }) => d)
  .handler(async ({ data, context }) => {
    const wid = await getWorkspaceId(context.supabase, context.userId);
    const row = await loadConnection(data.id, wid);
    if (row.workspace_id !== wid) throw new Error("Forbidden");
    const connector = getConnector(row.connector_key);
    if (!connector) throw new Error("Unknown connector");

    const { data: runRow, error: runErr } = await context.supabase
      .from("sync_runs")
      .insert({
        workspace_id: wid,
        connection_id: row.id,
        connector_key: row.connector_key,
        trigger: data.trigger ?? "manual",
        status: "running",
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (runErr) throw runErr;

    try {
      const res = await connector.sync({
        connectionId: row.id,
        workspaceId: row.workspace_id,
        connectorKey: row.connector_key,
        credentials: (row.credentials as Record<string, unknown>) ?? {},
        oauthTokens: (row.oauth_tokens as Record<string, unknown>) ?? {},
      });

      await context.supabase.from("sync_runs").update({
        status: res.status,
        finished_at: new Date().toISOString(),
        orders_imported: res.ordersImported,
        orders_updated: res.ordersUpdated,
        orders_failed: res.ordersFailed,
        tracking_updated: res.trackingUpdated,
        error_message: res.errorMessage ?? null,
        metadata: res.metadata ?? {},
      }).eq("id", runRow.id);

      await context.supabase.from("connector_connections").update({
        last_sync_at: new Date().toISOString(),
        last_sync_status: res.status,
        last_error: res.errorMessage ?? null,
        last_error_at: res.errorMessage ? new Date().toISOString() : null,
      }).eq("id", row.id);

      if (res.status === "failed" || res.errorMessage) {
        await logError(context.supabase, {
          workspaceId: wid, connectionId: row.id, syncRunId: runRow.id,
          connectorKey: row.connector_key,
          type: "import_failed",
          message: res.errorMessage ?? "Sync failed",
        });
      }
      return { runId: runRow.id, ...res };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      await context.supabase.from("sync_runs").update({
        status: "failed", finished_at: new Date().toISOString(), error_message: message,
      }).eq("id", runRow.id);
      await logError(context.supabase, {
        workspaceId: wid, connectionId: row.id, syncRunId: runRow.id,
        connectorKey: row.connector_key, type: "other", message,
      });
      throw e;
    }
  });

// ─────────────────────── History & error logs ───────────────────────
export const listSyncRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { connectionId?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("sync_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.connectionId) q = q.eq("connection_id", data.connectionId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });

export const listErrorLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { connectionId?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("connector_error_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.connectionId) q = q.eq("connection_id", data.connectionId);
    const { data: rows, error } = await q;
    if (error) throw error;
    return rows ?? [];
  });
