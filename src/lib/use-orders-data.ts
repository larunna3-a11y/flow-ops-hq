import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";

// Tables added in Sprint 2 may not be in the generated Database types yet.
// Use a loose client view to keep the surface ergonomic.
type AnyFrom = (table: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
};
const db = supabase as unknown as { from: AnyFrom };

export type Store = {
  id: string;
  workspace_id: string;
  name: string;
  marketplace: string;
  logo_url: string | null;
  store_status: "active" | "inactive";
  connection_status: "connected" | "disconnected" | "error" | "syncing";
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
};

export type Order = {
  id: string;
  workspace_id: string;
  store_id: string | null;
  order_number: string;
  marketplace: string | null;
  store_name: string | null;
  customer_name: string | null;
  tracking_number: string | null;
  courier: string | null;
  order_status: string;
  packing_status: "waiting" | "assigned" | "packing" | "packed" | "shipped";
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  ordered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ImportBatch = {
  id: string;
  workspace_id: string;
  imported_by: string | null;
  imported_by_name: string | null;
  filename: string | null;
  total_rows: number;
  success_count: number;
  failed_count: number;
  duplicate_count: number;
  status: string;
  created_at: string;
};

export function useStores() {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["stores", wid],
    enabled: !!wid,
    queryFn: async () => {
      const { data, error } = await db
        .from("stores")
        .select("*")
        .eq("workspace_id", wid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Store[];
    },
  });
}

export function useOrders(filters?: {
  search?: string;
  marketplace?: string;
  store?: string;
  status?: string;
}) {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["orders", wid, filters],
    enabled: !!wid,
    queryFn: async () => {
      let q = db
        .from("orders")
        .select("*")
        .eq("workspace_id", wid)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (filters?.marketplace && filters.marketplace !== "all")
        q = q.eq("marketplace", filters.marketplace);
      if (filters?.store && filters.store !== "all") q = q.eq("store_id", filters.store);
      if (filters?.status && filters.status !== "all") q = q.eq("packing_status", filters.status);
      if (filters?.search) {
        const s = filters.search.replace(/[%,]/g, "");
        q = q.or(
          `order_number.ilike.%${s}%,tracking_number.ilike.%${s}%,customer_name.ilike.%${s}%`,
        );
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });
}

export function useImports() {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["imports", wid],
    enabled: !!wid,
    queryFn: async () => {
      const { data, error } = await db
        .from("imports")
        .select("*")
        .eq("workspace_id", wid)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as ImportBatch[];
    },
  });
}

export const MARKETPLACES = ["Shopee", "TikTok Shop", "Tokopedia", "Lazada", "Blibli"] as const;
export const COURIERS = [
  "J&T Express",
  "SPX Express",
  "ID Express",
  "AnterAja",
  "SiCepat",
  "Ninja Xpress",
  "GoTo Logistics",
  "Lazada Express",
] as const;
export const PACKING_STATUSES = ["waiting", "assigned", "packing", "packed", "shipped"] as const;
