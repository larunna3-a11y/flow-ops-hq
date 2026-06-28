import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AutomationRule = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ScheduledReport = any;

async function getWs(supabase: any, userId: string) {
  const { data } = await supabase
    .from("users").select("workspace_id").eq("user_id", userId).maybeSingle();
  return data?.workspace_id as string | null;
}

/* ---------- Automation rules ---------- */

export const listRules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("automation_rules").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as AutomationRule[];
  });

export const upsertRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id?: string;
    name: string;
    category: "packing" | "returns" | "reports" | "system";
    trigger: string;
    config?: Record<string, unknown>;
    channels?: string[];
    enabled?: boolean;
  }) => data)
  .handler(async ({ data, context }) => {
    const workspaceId = await getWs(context.supabase, context.userId);
    if (!workspaceId) throw new Error("No workspace");

    const payload = {
      workspace_id: workspaceId,
      name: data.name,
      category: data.category,
      trigger: data.trigger,
      config: (data.config ?? {}) as never,
      channels: (data.channels ?? ["in_app"]) as never,
      enabled: data.enabled ?? true,
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("automation_rules").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("automation_rules").insert(payload).select("id").single();
    if (error) throw error;
    return { id: row.id };
  });

export const toggleRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_rules").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteRule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("automation_rules").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

/* ---------- Scheduled reports ---------- */

export const listSchedules = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("scheduled_reports").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as ScheduledReport[];
  });

function nextRunFor(frequency: string): string {
  const d = new Date();
  if (frequency === "daily") d.setDate(d.getDate() + 1);
  else if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "monthly") d.setMonth(d.getMonth() + 1);
  d.setHours(7, 0, 0, 0);
  return d.toISOString();
}

export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id?: string;
    name: string;
    report_type: "packing" | "returns" | "productivity" | "overview";
    frequency: "daily" | "weekly" | "monthly";
    format: "xlsx" | "pdf" | "csv";
    recipients: string[];
    enabled?: boolean;
  }) => d)
  .handler(async ({ data, context }) => {
    const workspaceId = await getWs(context.supabase, context.userId);
    if (!workspaceId) throw new Error("No workspace");
    const payload = {
      workspace_id: workspaceId,
      name: data.name,
      report_type: data.report_type,
      frequency: data.frequency,
      format: data.format,
      recipients: data.recipients as never,
      enabled: data.enabled ?? true,
      next_run_at: nextRunFor(data.frequency),
      created_by: context.userId,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("scheduled_reports").update(payload).eq("id", data.id);
      if (error) throw error;
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("scheduled_reports").insert(payload).select("id").single();
    if (error) throw error;
    return { id: row.id };
  });

export const toggleSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scheduled_reports").update({ enabled: data.enabled }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("scheduled_reports").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
