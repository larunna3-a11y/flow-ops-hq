import * as XLSX from "xlsx";

// Header signatures from Desty OMS "Daftar Pesanan" export.
const DESTY_REQUIRED_HEADERS = [
  "Nomor Pesanan\n(di Marketplace)",
  "Nomor AWB/Resi",
  "Channel - Nama Toko",
  "Nama Pembeli",
  "Nama Produk",
  "SKU Master",
  "Jumlah",
  "Kurir",
  "Tanggal Pesanan Dibuat",
];

const normalize = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

const MARKETPLACE_MAP: Record<string, string> = {
  tiktok: "TikTok Shop",
  "tiktok shop": "TikTok Shop",
  shopee: "Shopee",
  tokopedia: "Tokopedia",
  lazada: "Lazada",
  blibli: "Blibli",
};

function normalizeMarketplace(raw: unknown): string | null {
  const v = normalize(raw);
  if (!v) return null;
  for (const [k, label] of Object.entries(MARKETPLACE_MAP)) {
    if (v.includes(k)) return label;
  }
  return String(raw).trim() || null;
}

function parseDate(raw: unknown): string | null {
  if (raw == null || raw === "") return null;
  if (raw instanceof Date) return raw.toISOString();
  if (typeof raw === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0)));
      return dt.toISOString();
    }
  }
  const s = String(raw).trim();
  const d = new Date(s.replace(" ", "T"));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export type DestyOrderItem = {
  sku: string;
  sku_marketplace: string | null;
  product_name: string;
  product_variant: string | null;
  quantity: number;
};

export type DestyOrder = {
  order_number: string;
  tracking_number: string | null;
  store_name: string | null;
  marketplace: string | null;
  customer_name: string | null;
  courier: string | null;
  ordered_at: string | null;
  items: DestyOrderItem[];
};

export type DestyParseResult = {
  format: "desty-oms";
  orders: DestyOrder[];
  totalItems: number;
  totalRows: number;
};

export function isDestyHeaderRow(headers: unknown[]): boolean {
  const set = new Set(headers.map(normalize));
  return DESTY_REQUIRED_HEADERS.every((h) => set.has(normalize(h)));
}

export async function parseDestyFile(file: File): Promise<DestyParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  // Prefer "Daftar Pesanan" sheet, otherwise first sheet whose headers match.
  let sheetName = wb.SheetNames.find((n) => n.toLowerCase().includes("daftar pesanan"));
  let rows: Record<string, unknown>[] = [];
  if (sheetName) {
    rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: null, raw: true });
  } else {
    for (const n of wb.SheetNames) {
      const ws = wb.Sheets[n];
      const head = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, range: 0 })[0] ?? [];
      if (isDestyHeaderRow(head)) {
        sheetName = n;
        rows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: true });
        break;
      }
    }
  }
  if (!sheetName) {
    throw new Error("Unrecognised file format. Expected a Desty OMS order export (Daftar Pesanan).");
  }

  // Verify headers
  const sample = rows[0] ?? {};
  if (!isDestyHeaderRow(Object.keys(sample))) {
    throw new Error("This file doesn't match the Desty OMS column layout.");
  }

  const byOrder = new Map<string, DestyOrder>();
  for (const r of rows) {
    const orderNo = String(r["Nomor Pesanan\n(di Marketplace)"] ?? "").trim();
    if (!orderNo) continue;
    const qtyRaw = r["Jumlah"];
    const qty = Number(qtyRaw);
    const skuMaster = String(r["SKU Master"] ?? "").trim();
    const skuMp = String(r["SKU Marketplace"] ?? "").trim();
    const sku = skuMaster || skuMp;
    if (!sku) continue;

    const item: DestyOrderItem = {
      sku,
      sku_marketplace: skuMp || null,
      product_name: String(r["Nama Produk"] ?? "").trim() || sku,
      product_variant: (() => {
        const v = String(r["Varian Produk"] ?? "").trim();
        return v && v.toLowerCase() !== "default" ? v : null;
      })(),
      quantity: Number.isFinite(qty) && qty > 0 ? qty : 1,
    };

    let existing = byOrder.get(orderNo);
    if (!existing) {
      existing = {
        order_number: orderNo,
        tracking_number: (String(r["Nomor AWB/Resi"] ?? "").trim() || null),
        store_name: (String(r["Channel - Nama Toko"] ?? "").trim() || null),
        marketplace: normalizeMarketplace(r["Channel - Nama Toko"]) ?? null,
        customer_name: (String(r["Nama Pembeli"] ?? "").trim() || null),
        courier: (String(r["Kurir"] ?? "").trim() || null),
        ordered_at: parseDate(r["Tanggal Pesanan Dibuat"]),
        items: [],
      };
      byOrder.set(orderNo, existing);
    }
    existing.items.push(item);
  }

  const orders = Array.from(byOrder.values());
  const totalItems = orders.reduce((s, o) => s + o.items.length, 0);
  return { format: "desty-oms", orders, totalItems, totalRows: rows.length };
}
