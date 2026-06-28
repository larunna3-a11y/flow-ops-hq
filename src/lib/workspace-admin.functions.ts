import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getWs(supabase: any, userId: string) {
  const { data } = await supabase.from("users").select("workspace_id").eq("user_id", userId).maybeSingle();
  return data?.workspace_id as string | null;
}
async function assertOwner(supabase: any, userId: string) {
  const wid = await getWs(supabase, userId);
  if (!wid) throw new Error("No workspace");
  const { data } = await supabase.from("roles").select("role").eq("workspace_id", wid).eq("user_id", userId).maybeSingle();
  if (data?.role !== "Owner") throw new Error("Forbidden");
  return wid;
}

export type WorkspacePreferences = {
  active_marketplaces: string[];
  active_couriers: string[];
  packing_statuses: string[];
  return_reasons: string[];
};

export const updatePreferences = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Partial<WorkspacePreferences>) => d)
  .handler(async ({ data, context }) => {
    const wid = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("workspaces").select("preferences").eq("id", wid).maybeSingle();
    const current = (row?.preferences as any) ?? {};
    const merged = { ...current, ...data };
    const { error } = await supabaseAdmin.from("workspaces").update({ preferences: merged as never }).eq("id", wid);
    if (error) throw error;
    return { ok: true };
  });

export const updatePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { plan: "free" | "starter" | "professional" | "enterprise" }) => d)
  .handler(async ({ data, context }) => {
    // Placeholder — real plan changes will be driven by a payment provider webhook.
    const wid = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("workspaces").update({ plan: data.plan }).eq("id", wid);
    if (error) throw error;
    return { ok: true };
  });
