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
const CUSTOMERS = [
  "Budi Santoso",
  "Siti Nurhaliza",
  "Andi Wijaya",
  "Dewi Lestari",
  "Rizky Pratama",
  "Maya Anggraini",
  "Bagus Saputra",
  "Indah Permata",
  "Eko Prasetyo",
  "Linda Marlina",
  "Fajar Hidayat",
  "Citra Kirana",
];

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
      return `TKP-INV-${date.getFullYear()}-${pad(20000 + i, 5)}`;
    case "Lazada":
      return `LZD-${pad(880000000 + i, 9)}-${pad(i, 4)}`;
    case "Blibli":
      return `BLB-${ymd}-${pad(20000 + i, 5)}`;
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
  return `${prefix[courier] ?? "TRK"}${Date.now().toString().slice(-5)}${pad(i, 6)}`;
}

export const seedSprint2 = createServerFn({ method: "POST" })
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Skip if stores already exist.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as any;
    const { count: storeCount } = await sb
      .from("stores")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace_id);
    if ((storeCount ?? 0) > 0) return { seeded: false, reason: "already_seeded" };

    // ---- stores ----
    const storeRows = [
      { name: "Toko Sukses Jaya", marketplace: "Shopee", connection_status: "connected" },
      { name: "Sukses Jaya Official", marketplace: "TikTok Shop", connection_status: "connected" },
      { name: "Sukses Jaya Tokopedia", marketplace: "Tokopedia", connection_status: "connected" },
      { name: "Sukses Jaya Lazada", marketplace: "Lazada", connection_status: "disconnected" },
      { name: "Sukses Jaya Blibli", marketplace: "Blibli", connection_status: "connected" },
    ].map((s, i) => ({
      workspace_id,
      name: s.name,
      marketplace: s.marketplace,
      store_status: "active",
      connection_status: s.connection_status,
      last_sync_at:
        s.connection_status === "connected"
          ? new Date(Date.now() - i * 3600_000).toISOString()
          : null,
      created_by: userId,
    }));
    const { data: insertedStores, error: sErr } = await sb
      .from("stores")
      .insert(storeRows)
      .select("id, marketplace, name");
    if (sErr) throw sErr;
    const storesByMp = new Map<string, { id: string; name: string }>();
    for (const s of insertedStores ?? []) storesByMp.set(s.marketplace, { id: s.id, name: s.name });

    // ---- orders ----
    const PACKING = ["waiting", "assigned", "packing", "packed", "shipped"] as const;
    const orders = [];
    const now = Date.now();
    for (let i = 0; i < 60; i++) {
      const daysAgo = Math.floor(i / 12);
      const date = new Date(now - daysAgo * 86400000 - (i % 24) * 1500000);
      const marketplace = pick(MARKETPLACES, i);
      const courier = pick(COURIERS, i + 1);
      const store = storesByMp.get(marketplace);
      const status = pick(PACKING, i + (daysAgo === 0 ? 0 : 3));
      orders.push({
        workspace_id,
        store_id: store?.id ?? null,
        order_number: orderNumber(marketplace, i + 500, date),
        marketplace,
        store_name: store?.name ?? null,
        customer_name: pick(CUSTOMERS, i),
        tracking_number: status === "waiting" ? null : trackingNumber(courier, i + 500),
        courier,
        order_status: status === "shipped" ? "fulfilled" : "new",
        packing_status: status,
        ordered_at: date.toISOString(),
        created_at: date.toISOString(),
      });
    }
    const { error: oErr } = await sb.from("orders").insert(orders);
    if (oErr) throw oErr;

    // ---- one demo import history row ----
    await sb.from("imports").insert({
      workspace_id,
      imported_by: userId,
      imported_by_name: "Demo Seed",
      filename: "demo-orders.xlsx",
      total_rows: orders.length,
      success_count: orders.length,
      failed_count: 0,
      duplicate_count: 0,
      status: "completed",
    });

    return { seeded: true, stores: storeRows.length, orders: orders.length };
  });
