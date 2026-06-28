import { supabase } from "@/integrations/supabase/client";

export type DetectionRule = {
  id: string;
  workspace_id: string | null;
  type: "marketplace" | "courier";
  name: string;
  pattern: string;
  priority: number;
  enabled: boolean;
  notes: string | null;
  is_global: boolean;
  created_at: string;
  updated_at: string;
};

export type DetectionMethod = "database" | "pattern" | "qr" | "manual" | "unknown";

export type DetectionResult = {
  rawCode: string;
  orderNumber: string | null;
  trackingNumber: string | null;
  marketplace: string | null;
  courier: string | null;
  method: DetectionMethod;
  confidence: number; // 0..1
  matchedRules: { type: "marketplace" | "courier"; ruleId: string; name: string }[];
  qrPayload: Record<string, unknown> | null;
};

/** Try to parse a QR/barcode payload as JSON or simple key=value pairs. */
export function parseQrPayload(raw: string): Record<string, unknown> | null {
  const v = raw.trim();
  if (!v) return null;
  // JSON object
  if (v.startsWith("{")) {
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === "object") return obj as Record<string, unknown>;
    } catch {
      // fall through
    }
  }
  // URL with query string
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      const out: Record<string, string> = {};
      u.searchParams.forEach((val, key) => (out[key] = val));
      if (Object.keys(out).length) return out;
    } catch {
      // fall through
    }
  }
  // Pipe / semicolon delimited key=value pairs: "ORDER=ABC|TRACK=SPX1234|MP=Shopee"
  if (/[=][^=]+([|;,&])/.test(v) && /=/.test(v)) {
    const parts = v.split(/[|;,&]/).map((p) => p.trim()).filter(Boolean);
    const out: Record<string, string> = {};
    for (const p of parts) {
      const idx = p.indexOf("=");
      if (idx > 0) out[p.slice(0, idx).trim().toLowerCase()] = p.slice(idx + 1).trim();
    }
    if (Object.keys(out).length) return out;
  }
  return null;
}

function pickFromPayload(payload: Record<string, unknown> | null, keys: string[]): string | null {
  if (!payload) return null;
  for (const k of keys) {
    const direct = payload[k];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    const lower = Object.keys(payload).find((kk) => kk.toLowerCase() === k.toLowerCase());
    if (lower) {
      const v = payload[lower];
      if (typeof v === "string" && v.trim()) return v.trim();
      if (typeof v === "number") return String(v);
    }
  }
  return null;
}

function applyRules(
  rules: DetectionRule[],
  type: "marketplace" | "courier",
  candidates: string[],
): { name: string; ruleId: string } | null {
  const filtered = rules
    .filter((r) => r.enabled && r.type === type)
    .sort((a, b) => a.priority - b.priority);
  for (const r of filtered) {
    let rx: RegExp;
    try {
      rx = new RegExp(r.pattern, "i");
    } catch {
      continue;
    }
    for (const c of candidates) {
      if (c && rx.test(c)) return { name: r.name, ruleId: r.id };
    }
  }
  return null;
}

/** Loads detection rules for the workspace plus global defaults. */
export async function loadDetectionRules(workspaceId: string): Promise<DetectionRule[]> {
  const { data, error } = await supabase
    .from("detection_rules")
    .select("*")
    .or(`workspace_id.eq.${workspaceId},is_global.eq.true`)
    .order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DetectionRule[];
}

/**
 * Detection priority:
 *   1. Existing order in DB (highest, confidence 1.0)
 *   2. QR/barcode payload fields (confidence 0.9)
 *   3. Regex rule on tracking number (confidence 0.6)
 *   4. Unknown → method "unknown", confidence 0
 */
export async function detect(
  rawCode: string,
  opts: { workspaceId: string; rules?: DetectionRule[] },
): Promise<DetectionResult> {
  const value = rawCode.trim();
  const qrPayload = parseQrPayload(value);

  const payloadOrder = pickFromPayload(qrPayload, ["order_number", "orderNumber", "order", "order_id", "ordno"]);
  const payloadTracking = pickFromPayload(qrPayload, ["tracking_number", "trackingNumber", "tracking", "awb", "resi"]);
  const payloadMarketplace = pickFromPayload(qrPayload, ["marketplace", "mp", "platform", "channel"]);
  const payloadCourier = pickFromPayload(qrPayload, ["courier", "carrier", "shipper"]);

  // 1. Existing order lookup — try raw value and any payload values
  const probes = Array.from(
    new Set([value, payloadOrder, payloadTracking].filter(Boolean) as string[]),
  );
  let order: {
    order_number: string;
    tracking_number: string | null;
    marketplace: string | null;
    courier: string | null;
  } | null = null;
  for (const probe of probes) {
    const { data } = await supabase
      .from("orders")
      .select("order_number, tracking_number, marketplace, courier")
      .eq("workspace_id", opts.workspaceId)
      .or(`tracking_number.eq.${probe},order_number.eq.${probe}`)
      .maybeSingle();
    if (data) {
      order = data;
      break;
    }
  }
  if (order) {
    return {
      rawCode: value,
      orderNumber: order.order_number,
      trackingNumber: order.tracking_number,
      marketplace: order.marketplace,
      courier: order.courier,
      method: "database",
      confidence: 1,
      matchedRules: [],
      qrPayload,
    };
  }

  // 2. QR payload — explicit fields
  if (qrPayload && (payloadOrder || payloadTracking || payloadMarketplace || payloadCourier)) {
    return {
      rawCode: value,
      orderNumber: payloadOrder,
      trackingNumber: payloadTracking ?? value,
      marketplace: payloadMarketplace,
      courier: payloadCourier,
      method: "qr",
      confidence: 0.9,
      matchedRules: [],
      qrPayload,
    };
  }

  // 3. Pattern rules on tracking-like value
  const rules = opts.rules ?? (await loadDetectionRules(opts.workspaceId));
  const candidates = [payloadTracking, value].filter(Boolean) as string[];
  const matchedMp = applyRules(rules, "marketplace", candidates);
  const matchedCourier = applyRules(rules, "courier", candidates);
  if (matchedMp || matchedCourier) {
    const matched: DetectionResult["matchedRules"] = [];
    if (matchedMp) matched.push({ type: "marketplace", ruleId: matchedMp.ruleId, name: matchedMp.name });
    if (matchedCourier) matched.push({ type: "courier", ruleId: matchedCourier.ruleId, name: matchedCourier.name });
    return {
      rawCode: value,
      orderNumber: payloadOrder,
      trackingNumber: payloadTracking ?? value,
      marketplace: matchedMp?.name ?? null,
      courier: matchedCourier?.name ?? null,
      method: "pattern",
      confidence: matchedMp && matchedCourier ? 0.7 : 0.5,
      matchedRules: matched,
      qrPayload,
    };
  }

  return {
    rawCode: value,
    orderNumber: payloadOrder,
    trackingNumber: payloadTracking ?? value,
    marketplace: null,
    courier: null,
    method: "unknown",
    confidence: 0,
    matchedRules: [],
    qrPayload,
  };
}