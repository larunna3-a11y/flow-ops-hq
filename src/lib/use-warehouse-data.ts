import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";

export type PackingRecord = {
  id: string;
  workspace_id: string;
  user_id: string;
  user_name: string;
  role: string | null;
  scan_timestamp: string;
  packing_timestamp: string | null;
  raw_code: string;
  order_number: string | null;
  tracking_number: string | null;
  marketplace: string | null;
  courier: string | null;
  status: "Pending" | "Packed" | "Shipped" | "Cancelled";
  created_at: string;
  updated_at: string;
};

export type ReturnRecord = {
  id: string;
  workspace_id: string;
  rma: string;
  order_number: string | null;
  marketplace: string | null;
  reason: string | null;
  status: "received" | "inspecting" | "restocked" | "rejected";
  assigned_to: string | null;
  assigned_to_name: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
};

export type AuditLog = {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  actor_name?: string | null;
};

export function usePackingRecords(filters?: {
  from?: string;
  to?: string;
  marketplace?: string;
  courier?: string;
  status?: string;
  userId?: string;
}) {
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["packing_records", workspaceId, filters],
    enabled: !!workspaceId,
    queryFn: async () => {
      let q = supabase
        .from("packing_records")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (filters?.from) q = q.gte("created_at", filters.from);
      if (filters?.to) q = q.lte("created_at", filters.to);
      if (filters?.marketplace && filters.marketplace !== "all")
        q = q.eq("marketplace", filters.marketplace);
      if (filters?.courier && filters.courier !== "all") q = q.eq("courier", filters.courier);
      if (filters?.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters?.userId && filters.userId !== "all") q = q.eq("user_id", filters.userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PackingRecord[];
    },
  });
}

export function useReturns() {
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["returns", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("returns")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ReturnRecord[];
    },
  });
}

export function useAuditLogs(limit = 25) {
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["audit_logs", workspaceId, limit],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = (data ?? []) as AuditLog[];
      const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p.full_name || p.email]));
        for (const r of rows) r.actor_name = r.actor_id ? map.get(r.actor_id) ?? null : null;
      }
      return rows;
    },
  });
}

export function useWorkspaceMembers() {
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["workspace_members", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data: m, error } = await supabase
        .from("users")
        .select("user_id")
        .eq("workspace_id", workspaceId!);
      if (error) throw error;
      const ids = (m ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return (profs ?? []).map((p) => ({ id: p.id, name: p.full_name || p.email }));
    },
  });
}
