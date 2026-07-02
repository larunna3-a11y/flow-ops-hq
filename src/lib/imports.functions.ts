import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side deletion of an entire imported batch and every record it
 * produced. Runs as the authenticated user so RLS enforces workspace &
 * role scoping (Managers-delete-* policies allow Owner / Supervisor).
 *
 * Fixes vs. the previous client-side flow:
 *  - All .in(...) queries are CHUNKED so URL / query size limits never
 *    silently truncate the delete when a batch contains many orders.
 *  - Uses `orders.import_id` when present, falling back to a ±5 minute
 *    window on `created_at` for legacy imports where the column wasn't
 *    populated.
 *  - Explicit delete order prevents orphaned rows even when a FK is
 *    defined as ON DELETE SET NULL (returns.order_id, returns.packing_record_id):
 *      1. returns   (by order_id + by packing_record_id)
 *      2. packing_records (by order_number + tracking_number)
 *      3. order_items (by order_id — also cascades from orders)
 *      4. orders    (by id)
 *      5. imports   (the batch row itself)
 */
export const deleteImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { importId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const client = supabase as SupabaseClient<Database>;
    const importId = data.importId;

    // 1. Load the import row (RLS ensures caller belongs to this workspace).
    const { data: imp, error: impErr } = await client
      .from("imports")
      .select("id, workspace_id, created_at")
      .eq("id", importId)
      .maybeSingle();
    if (impErr) throw new Error(impErr.message);
    if (!imp) throw new Error("Import batch not found or you don't have access.");

    const workspaceId = imp.workspace_id;

    // 2. Role check — Owner or Supervisor only.
    const { data: roleRow, error: roleErr } = await client
      .from("roles")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    if (!roleRow || (roleRow.role !== "Owner" && roleRow.role !== "Supervisor")) {
      throw new Error("Only Owners and Supervisors can delete an import batch.");
    }

    // 3. Collect matching orders — prefer import_id, fall back to time window.
    let orderRows: Array<{
      id: string;
      order_number: string | null;
      tracking_number: string | null;
    }> = [];

    const { data: byImportId, error: byImportErr } = await client
      .from("orders")
      .select("id, order_number, tracking_number")
      .eq("workspace_id", workspaceId)
      .eq("import_id", importId);
    if (byImportErr) throw new Error(byImportErr.message);
    orderRows = byImportId ?? [];

    if (orderRows.length === 0) {
      const createdAt = new Date(imp.created_at).getTime();
      const from = new Date(createdAt - 5 * 60_000).toISOString();
      const to = new Date(createdAt + 5 * 60_000).toISOString();
      const { data: byWindow, error: byWindowErr } = await client
        .from("orders")
        .select("id, order_number, tracking_number")
        .eq("workspace_id", workspaceId)
        .is("import_id", null)
        .gte("created_at", from)
        .lte("created_at", to);
      if (byWindowErr) throw new Error(byWindowErr.message);
      orderRows = byWindow ?? [];
    }

    const orderIds = orderRows.map((r) => r.id);
    const orderNumbers = Array.from(
      new Set(orderRows.map((r) => r.order_number).filter((v): v is string => !!v)),
    );
    const trackingNumbers = Array.from(
      new Set(orderRows.map((r) => r.tracking_number).filter((v): v is string => !!v)),
    );

    const CHUNK = 100;
    const chunk = <T>(arr: T[]): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += CHUNK) out.push(arr.slice(i, i + CHUNK));
      return out;
    };

    let deletedReturns = 0;
    let deletedPacking = 0;
    let deletedOrderItems = 0;
    let deletedOrders = 0;

    if (orderIds.length) {
      // 4a. Returns linked by order_id.
      for (const ids of chunk(orderIds)) {
        const { data: del, error } = await client
          .from("returns")
          .delete()
          .eq("workspace_id", workspaceId)
          .in("order_id", ids)
          .select("id");
        if (error) throw new Error(`Delete returns failed: ${error.message}`);
        deletedReturns += del?.length ?? 0;
      }

      // 4b. Packing records — matched by order_number and tracking_number.
      //     Delete packing_records BEFORE any potentially-orphan returns
      //     that still reference them via packing_record_id (SET NULL FK).
      const packingIdsToRemove = new Set<string>();
      for (const nums of chunk(orderNumbers)) {
        if (!nums.length) continue;
        const { data: rows, error } = await client
          .from("packing_records")
          .select("id")
          .eq("workspace_id", workspaceId)
          .in("order_number", nums);
        if (error) throw new Error(`Read packing records failed: ${error.message}`);
        (rows ?? []).forEach((r: { id: string }) => packingIdsToRemove.add(r.id));
      }
      for (const trks of chunk(trackingNumbers)) {
        if (!trks.length) continue;
        const { data: rows, error } = await client
          .from("packing_records")
          .select("id")
          .eq("workspace_id", workspaceId)
          .in("tracking_number", trks);
        if (error) throw new Error(`Read packing records failed: ${error.message}`);
        (rows ?? []).forEach((r: { id: string }) => packingIdsToRemove.add(r.id));
      }

      const packingIds = Array.from(packingIdsToRemove);
      if (packingIds.length) {
        // Delete returns referencing these packing records first.
        for (const ids of chunk(packingIds)) {
          const { error } = await client
            .from("returns")
            .delete()
            .eq("workspace_id", workspaceId)
            .in("packing_record_id", ids);
          if (error) throw new Error(`Delete returns by packing_record failed: ${error.message}`);
        }
        for (const ids of chunk(packingIds)) {
          const { data: del, error } = await client
            .from("packing_records")
            .delete()
            .eq("workspace_id", workspaceId)
            .in("id", ids)
            .select("id");
          if (error) throw new Error(`Delete packing records failed: ${error.message}`);
          deletedPacking += del?.length ?? 0;
        }
      }

      // 4c. Order items (explicit — orders CASCADE would also remove them).
      for (const ids of chunk(orderIds)) {
        const { data: del, error } = await client
          .from("order_items")
          .delete()
          .eq("workspace_id", workspaceId)
          .in("order_id", ids)
          .select("id");
        if (error) throw new Error(`Delete order items failed: ${error.message}`);
        deletedOrderItems += del?.length ?? 0;
      }

      // 4d. Orders themselves.
      for (const ids of chunk(orderIds)) {
        const { data: del, error } = await client
          .from("orders")
          .delete()
          .eq("workspace_id", workspaceId)
          .in("id", ids)
          .select("id");
        if (error) throw new Error(`Delete orders failed: ${error.message}`);
        deletedOrders += del?.length ?? 0;
      }
    }

    // 5. Finally the import batch row.
    const { error: impDelErr } = await client
      .from("imports")
      .delete()
      .eq("id", importId)
      .eq("workspace_id", workspaceId);
    if (impDelErr) throw new Error(`Delete import row failed: ${impDelErr.message}`);

    return {
      ok: true as const,
      deletedReturns,
      deletedPacking,
      deletedOrderItems,
      deletedOrders,
    };
  });
