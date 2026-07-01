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
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type ReturnRecord = {
  id: string;
  workspace_id: string;
  rma: string;
  return_number: string | null;
  order_id: string | null;
  tracking_number: string | null;
  courier: string | null;
  customer_name: string | null;
  packing_record_id: string | null;
  packer_name: string | null;
  packing_date: string | null;
  condition: string | null;
  inspection_notes: string | null;
  inspection_photos: { path: string; url?: string }[];
  inspection_date: string | null;
  inspector_id: string | null;
  inspector_name: string | null;
  resolution: string | null;
  completed_at: string | null;
  order_number: string | null;
  marketplace: string | null;
  reason: string | null;
  status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
};

export type ReturnItem = {
  id: string;
  workspace_id: string;
  return_id: string;
  order_item_id: string | null;
  sku: string | null;
  product_name: string | null;
  product_variant: string | null;
  original_quantity: number;
  returned_quantity: number;
  missing_quantity: number;
  damaged_quantity: number;
  wrong_quantity: number;
  inventory_action: "none" | "restock" | "damaged" | "quarantine";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ReturnTimelineEntry = {
  id: string;
  workspace_id: string;
  return_id: string;
  event: string;
  message: string | null;
  actor_id: string | null;
  actor_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
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
      if (filters?.marketplace && filters.marketplace !== "all") q = q.eq("marketplace", filters.marketplace);
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
        for (const r of rows) r.actor_name = r.actor_id ? (map.get(r.actor_id) ?? null) : null;
      }
      return rows;
    },
  });
}

/**
 * "Today's Packers" widget (Owner/Supervisor dashboard only).
 * Aggregates today's packing_records client-side from a single scoped query
 * (created_at within today + status = 'Packed'), grouped by packer.
 * A packer is "Active" if their last scan was within the last 15 minutes.
 */
export type TodayPacker = {
  userId: string;
  name: string;
  packedOrders: number;
  lastScanTime: string;
  isActive: boolean;
};

const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

export function useTodayPackers() {
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["today_packers", workspaceId],
    enabled: !!workspaceId,
    refetchInterval: 30_000,
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from("packing_records")
        .select("user_id, user_name, status, scan_timestamp, created_at")
        .eq("workspace_id", workspaceId!)
        .eq("status", "Packed")
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .order("scan_timestamp", { ascending: false })
        // High cap, not a realistic ceiling — keeps this exactly in sync with the
        // unbounded COUNT() used for the Dashboard "Packed" KPI (usePackingProgress).
        .limit(50000);
      if (error) throw error;

      const byUser = new Map<string, TodayPacker>();
      for (const r of data ?? []) {
        const scanTime = r.scan_timestamp ?? r.created_at;
        const existing = byUser.get(r.user_id);
        if (existing) {
          existing.packedOrders += 1;
          if (scanTime > existing.lastScanTime) existing.lastScanTime = scanTime;
        } else {
          byUser.set(r.user_id, {
            userId: r.user_id,
            name: r.user_name,
            packedOrders: 1,
            lastScanTime: scanTime,
            isActive: false,
          });
        }
      }

      const now = Date.now();
      const packers = Array.from(byUser.values()).map((p) => ({
        ...p,
        isActive: now - new Date(p.lastScanTime).getTime() <= ACTIVE_WINDOW_MS,
      }));

      return packers.sort((a, b) => b.packedOrders - a.packedOrders);
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
        .select("user_id, status")
        .eq("workspace_id", workspaceId!);

      if (error) throw error;
      const ids = (m ?? []).map((r) => r.user_id);
      if (!ids.length) return [];
      const [{ data: profs }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, last_login").in("id", ids),
        supabase.from("roles").select("user_id, role").in("user_id", ids).eq("workspace_id", workspaceId!),
      ]);
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as string]));
      const statusMap = new Map((m ?? []).map((u) => [u.user_id, u.status as string]));
      return (profs ?? []).map((p) => ({
        id: p.id,
        name: p.full_name || p.email,
        email: p.email,
        last_login: (p as { last_login?: string | null }).last_login ?? null,
        role: roleMap.get(p.id) ?? null,
        status: statusMap.get(p.id) ?? "active",
      }));
    },
  });
}
