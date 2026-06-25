import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const logActivity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    action: string;
    target_type?: string | null;
    target_id?: string | null;
    metadata?: Record<string, unknown>;
  }) => data)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const { data: u } = await supabase
      .from("users")
      .select("workspace_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!u) return { id: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("audit_logs")
      .insert({
        workspace_id: u.workspace_id,
        actor_id: userId,
        action: data.action,
        target_type: data.target_type ?? null,
        target_id: data.target_id ?? null,
        metadata: (data.metadata ?? {}) as never,
      })
      .select("id")
      .single();
    if (error) throw error;
    return { id: row.id };
  });
