import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Delete an imported batch and every row it produced, in the correct order.
 *
 *  1. return_items       (by return_id)
 *  2. return_timeline    (by return_id)
 *  3. returns            (by order_id / order_number)
 *  4. packing_records    (by order_number OR tracking_number)
 *  5. order_items        (by order_id)
 *  6. orders             (by id)
 *  7. imports            (the batch itself)
 *
 * Runs with the service-role client so:
 *   - it never hits gateway/URL-length limits from oversized `.in()` filters
 *     (the previous client-side flow returned bare `Bad Request` on large batches),
 *   - one authorization check (Owner / Supervisor of the batch's workspace)
 *     covers the whole cascade instead of fighting per-table RLS.
 *
 * Orders that belong to the batch are matched by their `import_id` column
 * (new — set at import time) with a fallback to the legacy ±60s window so
 * historical batches created before that column existed can still be cleaned up.
 */
export const deleteImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ importId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Load the import row and confirm the caller can manage that workspace.
    const { data: imp, error: impErr } = await supabaseAdmin
      .from("imports")
      .select("id, workspace_id, created_at, filename")
      .eq("id", data.importId)
      .maybeSingle();
    if (impErr) throw new Error(impErr.message);
    if (!imp) throw new Error("Import not found.");

    const workspaceId = imp.workspace_id as string;

    // Authorization: Owner or Supervisor of this workspace.
    const { data: roleRow, error: roleErr } = await supabaseAdmin
      .from("roles")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (roleErr) throw new Error(roleErr.message);
    const role = (roleRow?.role as string | undefined) ?? null;
    if (role !== "Owner" && role !== "Supervisor") {
      throw new Error("Only Owners and Supervisors can delete import batches.");
    }

    // 2. Find every order that belongs to this batch. Prefer the explicit
    //    import_id link; fall back to a ±60s window around imports.created_at
    //    for legacy batches that pre-date the column.
    const createdAt = new Date(imp.created_at as string);
    const fromIso = new Date(createdAt.getTime() - 60_000).toISOString();
    const toIso = new Date(createdAt.getTime() + 60_000).toISOString();

    const [linkedRes, windowRes] = await Promise.all([
      supabaseAdmin
        .from("orders")
        .select("id, order_number, tracking_number")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("import_id" as any, data.importId)
        .eq("workspace_id", workspaceId),
      supabaseAdmin
        .from("orders")
        .select("id, order_number, tracking_number, import_id")
        .eq("workspace_id", workspaceId)
        .gte("created_at", fromIso)
        .lte("created_at", toIso),
    ]);
    if (linkedRes.error) throw new Error(linkedRes.error.message);
    if (windowRes.error) throw new Error(windowRes.error.message);

    const byId = new Map<string, { id: string; order_number: string | null; tracking_number: string | null }>();
    for (const r of (linkedRes.data ?? []) as Array<{
      id: string;
      order_number: string | null;
      tracking_number: string | null;
    }>) {
      byId.set(r.id, r);
    }
    for (const r of (windowRes.data ?? []) as Array<{
      id: string;
      order_number: string | null;
      tracking_number: string | null;
      import_id: string | null;
    }>) {
      // Only fall back to the window match when the row has no import link yet.
      if (r.import_id && r.import_id !== data.importId) continue;
      byId.set(r.id, { id: r.id, order_number: r.order_number, tracking_number: r.tracking_number });
    }

    const orderRows = Array.from(byId.values());
    const orderIds = orderRows.map((r) => r.id);
    const orderNumbers = Array.from(
      new Set(orderRows.map((r) => r.order_number).filter((n): n is string => !!n)),
    );
    const trackingNumbers = Array.from(
      new Set(orderRows.map((r) => r.tracking_number).filter((n): n is string => !!n)),
    );

    let removedReturns = 0;
    let removedPacking = 0;
    let removedItems = 0;
    let removedOrders = 0;

    if (orderIds.length) {
      // 3. Locate every return tied to those orders (by order_id or order_number)
      //    so we can wipe their dependents first.
      const returnIdSet = new Set<string>();
      const retById = await supabaseAdmin
        .from("returns")
        .select("id")
        .eq("workspace_id", workspaceId)
        .in("order_id", orderIds);
      if (retById.error) throw new Error(`returns lookup by order_id: ${retById.error.message}`);
      for (const r of (retById.data ?? []) as Array<{ id: string }>) returnIdSet.add(r.id);

      if (orderNumbers.length) {
        const retByNum = await supabaseAdmin
          .from("returns")
          .select("id")
          .eq("workspace_id", workspaceId)
          .in("order_number", orderNumbers);
        if (retByNum.error) throw new Error(`returns lookup by order_number: ${retByNum.error.message}`);
        for (const r of (retByNum.data ?? []) as Array<{ id: string }>) returnIdSet.add(r.id);
      }

      const returnIds = Array.from(returnIdSet);
      if (returnIds.length) {
        // 4. return_items and return_timeline have no ON DELETE CASCADE — remove
        //    them explicitly before their parent returns.
        const riErr = await supabaseAdmin
          .from("return_items")
          .delete()
          .eq("workspace_id", workspaceId)
          .in("return_id", returnIds);
        if (riErr.error) throw new Error(`return_items: ${riErr.error.message}`);

        const rtErr = await supabaseAdmin
          .from("return_timeline")
          .delete()
          .eq("workspace_id", workspaceId)
          .in("return_id", returnIds);
        if (rtErr.error) throw new Error(`return_timeline: ${rtErr.error.message}`);

        const rDel = await supabaseAdmin
          .from("returns")
          .delete({ count: "exact" })
          .eq("workspace_id", workspaceId)
          .in("id", returnIds);
        if (rDel.error) throw new Error(`returns: ${rDel.error.message}`);
        removedReturns = rDel.count ?? returnIds.length;
      }

      // 5. Packing records — matched by order_number OR tracking_number.
      if (orderNumbers.length) {
        const p1 = await supabaseAdmin
          .from("packing_records")
          .delete({ count: "exact" })
          .eq("workspace_id", workspaceId)
          .in("order_number", orderNumbers);
        if (p1.error) throw new Error(`packing_records by order_number: ${p1.error.message}`);
        removedPacking += p1.count ?? 0;
      }
      if (trackingNumbers.length) {
        const p2 = await supabaseAdmin
          .from("packing_records")
          .delete({ count: "exact" })
          .eq("workspace_id", workspaceId)
          .in("tracking_number", trackingNumbers);
        if (p2.error) throw new Error(`packing_records by tracking_number: ${p2.error.message}`);
        removedPacking += p2.count ?? 0;
      }

      // 6. Order items, then orders.
      const oi = await supabaseAdmin
        .from("order_items")
        .delete({ count: "exact" })
        .eq("workspace_id", workspaceId)
        .in("order_id", orderIds);
      if (oi.error) throw new Error(`order_items: ${oi.error.message}`);
      removedItems = oi.count ?? 0;

      const od = await supabaseAdmin
        .from("orders")
        .delete({ count: "exact" })
        .eq("workspace_id", workspaceId)
        .in("id", orderIds);
      if (od.error) throw new Error(`orders: ${od.error.message}`);
      removedOrders = od.count ?? 0;
    }

    // 7. Finally the import row itself.
    const impDel = await supabaseAdmin
      .from("imports")
      .delete()
      .eq("id", data.importId)
      .eq("workspace_id", workspaceId);
    if (impDel.error) throw new Error(`imports: ${impDel.error.message}`);

    return {
      ok: true as const,
      workspaceId,
      filename: (imp.filename as string | null) ?? null,
      removedReturns,
      removedPacking,
      removedItems,
      removedOrders,
    };
  });
