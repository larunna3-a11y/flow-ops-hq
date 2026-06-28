import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type NotificationRow = any;

/** Internal helper – not a server fn. Resolves the caller's workspace. */
async function getWorkspaceId(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.workspace_id ?? null;
}

export const listNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { limit?: number; unreadOnly?: boolean } = {}) => data)
  .handler(async ({ data, context }) => {
    const limit = Math.min(data.limit ?? 50, 200);
    let q = context.supabase
      .from("notifications")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (data.unreadOnly) q = q.is("read_at", null);
    const { data: rows, error } = await q;
    if (error) throw error;
    return (rows ?? []) as NotificationRow[];
  });

export const unreadCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count, error } = await context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw error;
    return { count: count ?? 0 };
  });

export const markRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const markAllRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if (error) throw error;
    return { ok: true };
  });

export const clearAll = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("notifications")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

/**
 * Create a notification for one or many users in the caller's workspace.
 * Used by other modules (imports, packing, returns, exports …) to emit events.
 * Roles filter: when `roles` is provided, recipients are all workspace members
 * holding any of those roles. Falls back to `userIds` when provided.
 */
export const createNotification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    type: string;
    title: string;
    body?: string;
    link?: string;
    severity?: "info" | "success" | "warning" | "error";
    metadata?: Record<string, unknown>;
    userIds?: string[];
    roles?: string[];
  }) => data)
  .handler(async ({ data, context }) => {
    const workspaceId = await getWorkspaceId(context.supabase, context.userId);
    if (!workspaceId) return { inserted: 0 };

    let recipients: string[] = data.userIds ?? [];
    if (data.roles && data.roles.length) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: roleRows } = await supabaseAdmin
        .from("roles")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .in("role", data.roles as never);
      recipients = Array.from(new Set([...recipients, ...(roleRows ?? []).map((r: any) => r.user_id)]));
    }
    if (recipients.length === 0) return { inserted: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = recipients.map((uid) => ({
      workspace_id: workspaceId,
      user_id: uid,
      type: data.type,
      title: data.title,
      body: data.body ?? null,
      link: data.link ?? null,
      severity: data.severity ?? "info",
      metadata: (data.metadata ?? {}) as never,
    }));
    const { error, count } = await supabaseAdmin
      .from("notifications")
      .insert(rows, { count: "exact" });
    if (error) throw error;
    return { inserted: count ?? rows.length };
  });
