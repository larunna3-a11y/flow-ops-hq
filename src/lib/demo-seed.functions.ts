import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MARKETPLACES = ["Shopee", "TikTok Shop", "Tokopedia", "Lazada", "Blibli"] as const;
const COURIERS = [
  "J&T Express",
  "SPX Express",
  "ID Express",
  "AnterAja",
  "SiCepat",
  "Ninja Xpress",
  "GoTo Logistics",
  "Lazada Express",
] as const;
const STATUSES = ["Pending", "Packed", "Shipped", "Cancelled"] as const;
const RETURN_REASONS = ["Barang rusak", "Salah kirim", "Tidak sesuai deskripsi", "Terlambat", "Cacat produk"] as const;
const RETURN_STATUSES = ["received", "inspecting", "restocked", "rejected"] as const;

const pad = (n: number, w = 4) => String(n).padStart(w, "0");
const pick = <T,>(arr: readonly T[], i: number) => arr[i % arr.length];

function orderNumber(marketplace: string, i: number, date: Date) {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  switch (marketplace) {
    case "Shopee":
      return `INV/${ymd}/MPL/${pad(4400000 + i, 7)}`;
    case "TikTok Shop":
      return `TS-${ymd}${pad(i, 5)}`;
    case "Tokopedia":
      return `TKP-INV-${date.getFullYear()}-${pad(10000 + i, 5)}`;
    case "Lazada":
      return `LZD-${pad(880000000 + i, 9)}-${pad(i, 4)}`;
    case "Blibli":
      return `BLB-${ymd}-${pad(10000 + i, 5)}`;
    default:
      return `ORD-${ymd}-${pad(i, 6)}`;
  }
}

function trackingNumber(courier: string, i: number) {
  const prefix: Record<string, string> = {
    "J&T Express": "JT",
    "SPX Express": "SPXID",
    "ID Express": "IDE",
    "AnterAja": "AA",
    "SiCepat": "SIC",
    "Ninja Xpress": "NJV",
    "GoTo Logistics": "GTL",
    "Lazada Express": "LEX",
  };
  return `${prefix[courier] ?? "TRK"}${Date.now().toString().slice(-6)}${pad(i, 6)}`;
}

export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: u } = await supabase
      .from("users")
      .select("workspace_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!u) throw new Error("No workspace");
    const workspace_id = u.workspace_id;

    const { count } = await supabase
      .from("packing_records")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace_id);
    if ((count ?? 0) > 0) return { seeded: false, reason: "already_seeded" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Get workspace members
    const { data: members } = await supabaseAdmin
      .from("users")
      .select("user_id")
      .eq("workspace_id", workspace_id);
    const memberRows = members ?? [];

    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email")
      .in("id", memberRows.map((m) => m.user_id));
    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const { data: rolesRows } = await supabaseAdmin
      .from("roles")
      .select("user_id, role")
      .eq("workspace_id", workspace_id);
    const roleMap = new Map((rolesRows ?? []).map((r) => [r.user_id, r.role]));

    // ---- packing_records: 90 records spread across last 14 days ----
    const records: Array<Record<string, unknown>> = [];
    const now = Date.now();
    for (let i = 0; i < 90; i++) {
      const daysAgo = Math.floor(i / 7);
      const date = new Date(now - daysAgo * 86400000 - (i % 24) * 1800000);
      const marketplace = pick(MARKETPLACES, i);
      const courier = pick(COURIERS, i + 2);
      const status =
        daysAgo === 0 && i % 5 === 0
          ? "Pending"
          : pick(STATUSES, i + (daysAgo === 0 ? 1 : 3));
      const member = memberRows[i % Math.max(memberRows.length, 1)];
      const actor = member?.user_id ?? userId;
      const profile = profileMap.get(actor);
      const order = orderNumber(marketplace, i, date);
      const tracking = trackingNumber(courier, i);
      records.push({
        workspace_id,
        user_id: actor,
        user_name: profile?.full_name ?? profile?.email ?? "Operator",
        role: roleMap.get(actor) ?? "Packer",
        scan_timestamp: date.toISOString(),
        packing_timestamp: status === "Pending" ? null : date.toISOString(),
        raw_code: `BC${pad(8800000000 + i * 13, 10)}`,
        order_number: order,
        tracking_number: tracking,
        marketplace,
        courier,
        status,
        created_at: date.toISOString(),
      });
    }
    const { error: pErr } = await supabaseAdmin.from("packing_records").insert(records as never);
    if (pErr) throw pErr;

    // ---- returns: 12 ----
    const returns = Array.from({ length: 12 }, (_, i) => {
      const daysAgo = i % 5;
      const date = new Date(now - daysAgo * 86400000);
      const marketplace = pick(MARKETPLACES, i + 1);
      return {
        workspace_id,
        rma: `RMA-${pad(44000 + i, 5)}`,
        order_number: orderNumber(marketplace, 1000 + i, date),
        marketplace,
        reason: pick(RETURN_REASONS, i),
        status: pick(RETURN_STATUSES, i),
        received_at: date.toISOString(),
        created_at: date.toISOString(),
      };
    });
    const { error: rErr } = await supabaseAdmin.from("returns").insert(returns as never);
    if (rErr) throw rErr;

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id,
      actor_id: userId,
      action: "demo.seeded",
      target_type: "workspace",
      target_id: workspace_id,
      metadata: { records: records.length, returns: returns.length } as never,
    });

    return { seeded: true, records: records.length, returns: returns.length };
  });
