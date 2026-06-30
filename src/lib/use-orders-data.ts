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
  customer_phone: string | null;
  tracking_number: string | null;
  courier: string | null;
  order_status: string;
  packing_status: string;
  shipping_status: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_at: string | null;
  ordered_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  workspace_id: string;
  order_id: string;
  sku: string;
  product_name: string;
  product_variant: string | null;
  quantity: number;
  warehouse_location: string | null;
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

export type DashboardStats = {
  totalOrders: number;
  pendingOrders: number;
  packedOrders: number;
  shippedOrders: number;
  totalReturns: number;
  activePackers: number;
  activeUsers: number;
};

// --- Packing Progress (live, Owner/Supervisor dashboard widget) ---
export type PackingProgressStats = {
  todayOrders: number;
  pendingOrders: number;
  packedOrders: number;
  packingProgress: number; // 0-100
};

export type TodayPacker = {
  userId: string;
  name: string;
  packedOrders: number;
  lastScanTime: string;
  isActive: boolean;
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

/**
 * Single source of truth for "how many orders were packed" in a given
 * window. Counts `packing_records` rows with status = 'Packed' — the exact
 * same definition used to build the "Today's Packers" list — so every
 * dashboard widget that shows a "Packed" number is always counting the
 * same thing the same way.
 */
async function fetchPackedOrdersCount(workspaceId: string, range?: { from: string; to: string }): Promise<number> {
  let q = db
    .from("packing_records")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "Packed");
  if (range) q = q.gte("created_at", range.from).lte("created_at", range.to);
  const { count } = await q;
  return count ?? 0;
}

/**
 * Aggregate dashboard stats using server-side COUNT queries.
 * Never loads full rows — safe for any dataset size.
 * Accepts an optional date range (from/to ISO strings) to scope
 * time-sensitive stats; totalOrders always counts all orders.
 */
export function useDashboardStats(range?: { from: string; to: string }) {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["dashboard_stats", wid, range],
    enabled: !!wid,
    queryFn: async () => {
      // Run all aggregate queries in parallel for speed
      const [totalOrdersRes, packedOrders, shippedOrdersRes, totalReturnsRes, activePackersRes, activeUsersRes] =
        await Promise.all([
          // Total orders — always all orders, no date filter
          db.from("orders").select("id", { count: "exact", head: true }).eq("workspace_id", wid),

          // Packed orders — single source of truth, shared with
          // usePackingProgress / Today's Packers (see fetchPackedOrdersCount).
          fetchPackedOrdersCount(wid as string, range),

          // Shipped orders in range
          (() => {
            let q = db
              .from("orders")
              .select("id", { count: "exact", head: true })
              .eq("workspace_id", wid)
              .eq("packing_status", "shipped");
            if (range) q = q.gte("updated_at", range.from).lte("updated_at", range.to);
            return q;
          })(),

          // Total returns in range
          (() => {
            let q = db.from("returns").select("id", { count: "exact", head: true }).eq("workspace_id", wid);
            if (range) q = q.gte("created_at", range.from).lte("created_at", range.to);
            return q;
          })(),

          // Active packers = distinct user_ids in packing_records in range
          (() => {
            let q = db
              .from("packing_records")
              .select("user_id", { count: "exact", head: false })
              .eq("workspace_id", wid)
              .neq("status", "Cancelled");
            if (range) q = q.gte("created_at", range.from).lte("created_at", range.to);
            return q;
          })(),

          // Active users = distinct actors in audit_logs today
          (() => {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            return db
              .from("audit_logs")
              .select("actor_id", { count: "exact", head: false })
              .eq("workspace_id", wid)
              .gte("created_at", todayStart.toISOString())
              .not("actor_id", "is", null);
          })(),
        ]);

      // Distinct active packers (deduplicate user_ids client-side from small result)
      const activePackers = new Set((activePackersRes.data ?? []).map((r: { user_id: string }) => r.user_id)).size;

      // Distinct active users
      const activeUsers = new Set((activeUsersRes.data ?? []).map((r: { actor_id: string }) => r.actor_id)).size;

      const totalOrders = totalOrdersRes.count ?? 0;

      return {
        totalOrders,
        // Pending is always derived from the same totalOrders/packedOrders
        // numbers shown elsewhere on the dashboard — never queried via a
        // separate packing_status = 'pending' filter, so it can never
        // drift out of sync with what's actually been packed.
        pendingOrders: Math.max(0, totalOrders - packedOrders),
        packedOrders,
        shippedOrders: shippedOrdersRes.count ?? 0,
        totalReturns: totalReturnsRes.count ?? 0,
        activePackers,
        activeUsers,
      } as DashboardStats;
    },
  });
}

/**
 * Live "Packing Progress" widget stats for the Dashboard (Owner/Supervisor only).
 * All counts use server-side COUNT(head: true) aggregate queries — never loads
 * full row sets — so this stays cheap on large datasets.
 *
 * Business rules:
 * - todayOrders   = orders imported (created_at) today only. Resets automatically
 *                   at local midnight since it's derived from "now" on every fetch;
 *                   historical orders are never deleted or modified.
 * - packedOrders  = SUM(all successful packing confirmations today) across EVERY
 *                   packer in the workspace — i.e. count of packing_records with
 *                   status = 'Packed' and created_at today, workspace-wide (never
 *                   scoped to a single user). This is the exact same query
 *                   (workspace_id + status='Packed' + today), via the shared
 *                   fetchPackedOrdersCount() helper, used to build the
 *                   "Today's Packers" list in useTodayPackers() and the top
 *                   dashboard "Packed" KPI in useDashboardStats(), so this number
 *                   always equals the sum of every packer's count shown there.
 * - pendingOrders = todayOrders - packedOrders. Always derived from the same two
 *                   numbers shown elsewhere on this widget — never queried via a
 *                   separate packing_status = 'pending' filter — so it can never
 *                   drift out of sync with what's actually been packed.
 * - packingProgress = packedOrders / todayOrders * 100 (capped at 100, 0 when no
 *                   orders were imported today).
 */
export function usePackingProgress() {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["packing_progress", wid],
    enabled: !!wid,
    refetchInterval: 30_000,
    queryFn: async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayRange = { from: todayStart.toISOString(), to: todayEnd.toISOString() };

      const [todayOrdersRes, packedOrders] = await Promise.all([
        db
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wid)
          .gte("created_at", todayRange.from)
          .lte("created_at", todayRange.to),

        // Workspace-wide count of successful packing confirmations made today,
        // across ALL packers — never filtered to a single user. Shared helper
        // keeps this identical to useDashboardStats() and useTodayPackers().
        fetchPackedOrdersCount(wid as string, todayRange),
      ]);

      const todayOrders = todayOrdersRes.count ?? 0;
      const pendingOrders = Math.max(0, todayOrders - packedOrders);
      const packingProgress = todayOrders > 0 ? Math.min(100, Math.round((packedOrders / todayOrders) * 1000) / 10) : 0;

      return { todayOrders, pendingOrders, packedOrders, packingProgress } as PackingProgressStats;
    },
  });
}

// --- Packing Exception Report (Reports module — Owner/Supervisor) ---
export type PackingExceptionFilters = {
  /** ISO datetime — inclusive lower bound on orders.packed_at */
  from?: string;
  /** ISO datetime — inclusive upper bound on orders.packed_at */
  to?: string;
  marketplace?: string;
  storeId?: string;
  courier?: string;
  packerId?: string;
  /** "all" | "complete" (no missing items) | "incomplete" (has missing items) */
  completeness?: "all" | "complete" | "incomplete";
};

export type PackingExceptionRow = {
  orderId: string;
  orderNumber: string;
  trackingNumber: string | null;
  customerName: string | null;
  marketplace: string | null;
  storeName: string | null;
  courier: string | null;
  packedByName: string | null;
  packedAt: string | null;
  totalSku: number;
  packedSku: number;
  missingSku: number;
  missingQuantity: number;
  missingSkuList: string;
  packingNotes: string;
  isComplete: boolean;
};

/**
 * Live "Packing Exception Report" for Reports (Owner/Supervisor).
 * Sourced directly from `orders` (the same table Dashboard's stats use) joined
 * client-side with `order_items` (for total SKU counts) and `packing_records`
 * (for the missing-SKU breakdown + packing notes captured at confirmation time).
 * All heavy filtering (date range, marketplace, store, courier, packer,
 * complete/incomplete) happens server-side so this stays cheap on large datasets.
 */
export function usePackingExceptions(filters: PackingExceptionFilters) {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["packing_exceptions", wid, filters],
    enabled: !!wid,
    queryFn: async () => {
      let q = db
        .from("orders")
        .select(
          "id, order_number, tracking_number, customer_name, marketplace, store_name, store_id, courier, packed_by, packed_by_name, packed_at, packing_status",
        )
        .eq("workspace_id", wid)
        .in("packing_status", ["packed", "packed_with_missing"])
        .order("packed_at", { ascending: false })
        .limit(2000);

      if (filters.from) q = q.gte("packed_at", filters.from);
      if (filters.to) q = q.lte("packed_at", filters.to);
      if (filters.marketplace && filters.marketplace !== "all") q = q.eq("marketplace", filters.marketplace);
      if (filters.courier && filters.courier !== "all") q = q.eq("courier", filters.courier);
      if (filters.storeId && filters.storeId !== "all") q = q.eq("store_id", filters.storeId);
      if (filters.packerId && filters.packerId !== "all") q = q.eq("packed_by", filters.packerId);
      if (filters.completeness === "complete") q = q.eq("packing_status", "packed");
      if (filters.completeness === "incomplete") q = q.eq("packing_status", "packed_with_missing");

      const { data: orderRowsRaw, error } = await q;
      if (error) throw error;
      const orderRows = (orderRowsRaw ?? []) as Array<{
        id: string;
        order_number: string;
        tracking_number: string | null;
        customer_name: string | null;
        marketplace: string | null;
        store_name: string | null;
        store_id: string | null;
        courier: string | null;
        packed_by: string | null;
        packed_by_name: string | null;
        packed_at: string | null;
        packing_status: string;
      }>;
      if (!orderRows.length) return [] as PackingExceptionRow[];

      const orderIds = orderRows.map((o) => o.id);
      const orderNumbers = Array.from(new Set(orderRows.map((o) => o.order_number)));

      const [itemsRes, recordsRes] = await Promise.all([
        db.from("order_items").select("order_id").eq("workspace_id", wid).in("order_id", orderIds),
        db
          .from("packing_records")
          .select("order_number, missing_skus, missing_quantity, notes, updated_at")
          .eq("workspace_id", wid)
          .in("order_number", orderNumbers)
          .order("updated_at", { ascending: false }),
      ]);

      const totalSkuMap = new Map<string, number>();
      for (const it of (itemsRes.data ?? []) as Array<{ order_id: string }>) {
        totalSkuMap.set(it.order_id, (totalSkuMap.get(it.order_id) ?? 0) + 1);
      }

      // Keep only the most recent packing_record per order_number (already sorted desc).
      type MissingSku = { sku_master?: string | null; sku_marketplace?: string | null };
      const recordMap = new Map<
        string,
        { missing_skus: MissingSku[]; missing_quantity: number; notes: string | null }
      >();
      for (const r of (recordsRes.data ?? []) as Array<{
        order_number: string | null;
        missing_skus: MissingSku[] | null;
        missing_quantity: number | null;
        notes: string | null;
      }>) {
        if (!r.order_number || recordMap.has(r.order_number)) continue;
        recordMap.set(r.order_number, {
          missing_skus: r.missing_skus ?? [],
          missing_quantity: r.missing_quantity ?? 0,
          notes: r.notes ?? null,
        });
      }

      return orderRows.map((o) => {
        const rec = recordMap.get(o.order_number);
        const totalSku = totalSkuMap.get(o.id) ?? 0;
        const missingList = rec?.missing_skus ?? [];
        const missingSku = missingList.length;
        const missingQuantity = rec?.missing_quantity ?? 0;
        const packedSku = Math.max(0, totalSku - missingSku);
        const missingSkuList = missingList.map((m) => m.sku_master || m.sku_marketplace || "—").join(", ");
        return {
          orderId: o.id,
          orderNumber: o.order_number,
          trackingNumber: o.tracking_number,
          customerName: o.customer_name,
          marketplace: o.marketplace,
          storeName: o.store_name,
          courier: o.courier,
          packedByName: o.packed_by_name,
          packedAt: o.packed_at,
          totalSku,
          packedSku,
          missingSku,
          missingQuantity,
          missingSkuList,
          packingNotes: rec?.notes ?? "",
          isComplete: o.packing_status === "packed",
        } satisfies PackingExceptionRow;
      });
    },
  });
}

export function useOrders(filters?: { search?: string; marketplace?: string; store?: string; status?: string }) {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["orders", wid, filters],
    enabled: !!wid,
    queryFn: async () => {
      let q = db.from("orders").select("*").eq("workspace_id", wid).order("created_at", { ascending: false });
      if (filters?.marketplace && filters.marketplace !== "all") q = q.eq("marketplace", filters.marketplace);
      if (filters?.store && filters.store !== "all") q = q.eq("store_id", filters.store);
      if (filters?.status && filters.status !== "all") q = q.eq("packing_status", filters.status);
      if (filters?.search) {
        const s = filters.search.replace(/[%,]/g, "");
        // Find order_ids whose items match the SKU search term, then OR with header columns.
        const { data: skuMatches } = await db
          .from("order_items")
          .select("order_id")
          .eq("workspace_id", wid)
          .ilike("sku", `%${s}%`)
          .limit(500);
        const skuOrderIds = Array.from(new Set((skuMatches ?? []).map((r: { order_id: string }) => r.order_id)));
        const orParts = [`order_number.ilike.%${s}%`, `tracking_number.ilike.%${s}%`, `customer_name.ilike.%${s}%`];
        if (skuOrderIds.length) orParts.push(`id.in.(${skuOrderIds.join(",")})`);
        q = q.or(orParts.join(","));
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Order[];
    },
  });
}

export function useOrderItems(orderId: string | null | undefined) {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  return useQuery({
    queryKey: ["order_items", wid, orderId],
    enabled: !!wid && !!orderId,
    queryFn: async () => {
      const { data, error } = await db
        .from("order_items")
        .select("*")
        .eq("workspace_id", wid)
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrderItem[];
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
export const PACKING_STATUSES = [
  "new",
  "ready",
  "packing",
  "packed",
  "shipped",
  "delivered",
  "returned",
  "cancelled",
] as const;

// Backward-compatible aliases for legacy values stored in DB rows.
export const PACKING_STATUS_ALIASES: Record<string, string> = {
  waiting: "new",
  assigned: "ready",
};

export const ORDER_STATUSES = PACKING_STATUSES;
