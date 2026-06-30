import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ScanLine,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Camera,
  RefreshCw,
  X,
  PackageCheck,
  Pencil,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";
import { usePackingRecords } from "@/lib/use-warehouse-data";
import { logActivity } from "@/lib/activity.functions";
import { notify } from "@/lib/notify";
import { detect, type DetectionResult } from "@/lib/detection";
import { MARKETPLACES, COURIERS, useDashboardStats } from "@/lib/use-orders-data";

export const Route = createFileRoute("/_app/packing")({
  head: () => ({
    meta: [
      { title: "Packing — FlowOps" },
      { name: "description", content: "Scan, verify, and confirm packing in one workflow." },
    ],
  }),
  component: PackingPage,
});

type OrderItem = {
  id: string;
  sku: string;
  sku_marketplace?: string | null;
  sku_master?: string | null;
  product_name: string;
  product_variant: string | null;
  quantity: number;
  warehouse_location: string | null;
};

type LookupOrder = {
  id: string;
  order_number: string;
  tracking_number: string | null;
  marketplace: string | null;
  store_name: string | null;
  courier: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  packing_status: string;
  order_status: string;
  items: OrderItem[];
};

type ScanState = {
  code: string;
  scanType: "keyboard" | "camera";
  order: LookupOrder | null;
  duplicate: { id: string; created_at: string; user_name: string } | null;
  notFound: boolean;
  loading: boolean;
  detection: DetectionResult | null;
  override: { marketplace: string | null; courier: string | null };
  verifiedItems: Record<string, boolean>;
  missingQty: Record<string, number>;
  /** If set, we're editing an existing packing_record instead of creating a new one */
  editingRecordId: string | null;
};

const INITIAL_STATE: ScanState = {
  code: "",
  scanType: "keyboard",
  order: null,
  duplicate: null,
  notFound: false,
  loading: false,
  detection: null,
  override: { marketplace: null, courier: null },
  verifiedItems: {},
  missingQty: {},
  editingRecordId: null,
};

function detectDevice() {
  if (typeof navigator === "undefined") return "Unknown";
  return /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? "Mobile" : "Desktop";
}

function PackingPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const log = useServerFn(logActivity);
  const codeRef = useRef<HTMLInputElement>(null);

  const [scan, setScan] = useState<ScanState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; orderNumber: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const role = ws.data?.role ?? null;
  const currentUserId = ws.data?.userId ?? null;
  const canOverrideDuplicate = role === "Owner" || role === "Supervisor";
  const canDelete = role === "Owner" || role === "Supervisor";
  /** Owners & Supervisors can edit every record; Packers only their own. */
  const canEditRecord = (recordUserId: string | null | undefined) =>
    role === "Owner" || role === "Supervisor" || (!!currentUserId && recordUserId === currentUserId);

  const recordsQuery = usePackingRecords();
  const records = recordsQuery.data ?? [];

  /**
   * KPIs are derived from the SAME source of truth as the Dashboard:
   *   pendingOrders / totalOrders / packedOrders come from useDashboardStats
   *   which runs server-side COUNTs against the orders table.
   * This guarantees Dashboard's "Pending Orders" and Packing's "In Queue"
   * always show identical numbers. After every confirmPacking we invalidate
   * `dashboard_stats` and `orders`, so both widgets refresh automatically.
   */
  const dashboardStats = useDashboardStats();
  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const todayRecords = records.filter((r) => r.created_at >= todayIso);

    const totalOrders = dashboardStats.data?.totalOrders ?? 0;
    const inQueue = dashboardStats.data?.pendingOrders ?? 0;
    const packedOrders = dashboardStats.data?.packedOrders ?? 0;
    const packProgress = totalOrders > 0 ? Math.round((packedOrders / totalOrders) * 100) : 0;

    return {
      totalOrders,
      inQueue,
      packedOrders,
      packProgress,
      activePackers: new Set(todayRecords.map((r) => r.user_id)).size,
      packedToday: todayRecords.filter((r) => r.status !== "Pending" && r.status !== "Cancelled").length,
      shipped: records.filter((r) => r.status === "Shipped").length,
    };
  }, [records, dashboardStats.data]);

  async function lookup(code: string, scanType: "keyboard" | "camera") {
    const value = code.trim();
    if (!value) return;
    const workspace = ws.data?.workspace;
    if (!workspace) {
      toast.error("Workspace not loaded");
      return;
    }
    setScan({ ...INITIAL_STATE, code: value, scanType, loading: true });

    let detection: DetectionResult;
    try {
      detection = await detect(value, { workspaceId: workspace.id });
    } catch (err) {
      toast.error((err as Error).message);
      setScan((s) => ({ ...s, loading: false }));
      return;
    }

    let order: LookupOrder | null = null;
    const tryNumbers = [value];
    if (detection.orderNumber && detection.orderNumber !== value) tryNumbers.push(detection.orderNumber);
    if (detection.trackingNumber && !tryNumbers.includes(detection.trackingNumber))
      tryNumbers.push(detection.trackingNumber);

    const orClauses = tryNumbers.flatMap((n) => [`order_number.eq.${n}`, `tracking_number.eq.${n}`]).join(",");

    const { data: orderRow } = await supabase
      .from("orders")
      .select(
        "id, order_number, tracking_number, marketplace, store_name, courier, customer_name, customer_phone, packing_status, order_status",
      )
      .eq("workspace_id", workspace.id)
      .or(orClauses)
      .limit(1)
      .maybeSingle();

    if (orderRow) {
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderRow.id)
        .order("created_at", { ascending: true });
      order = {
        ...orderRow,
        items: (items ?? []).map((it: Record<string, unknown>) => ({
          id: it.id as string,
          sku: (it.sku as string) ?? "",
          sku_marketplace: (it.sku_marketplace as string | null) ?? null,
          sku_master: (it.sku_master as string | null) ?? null,
          product_name: (it.product_name as string) ?? "",
          product_variant: (it.product_variant as string | null) ?? null,
          quantity: (it.quantity as number) ?? 0,
          warehouse_location: (it.warehouse_location as string | null) ?? null,
        })),
      };
    }

    const orList = [`raw_code.eq.${value}`];
    const trackingForDup = order?.tracking_number ?? detection.trackingNumber;
    if (trackingForDup && trackingForDup !== value) orList.push(`tracking_number.eq.${trackingForDup}`);
    const { data: dups } = await supabase
      .from("packing_records")
      .select("id, created_at, user_name")
      .eq("workspace_id", workspace.id)
      .or(orList.join(","))
      .order("created_at", { ascending: false })
      .limit(1);

    const duplicate = dups && dups.length > 0 ? dups[0] : null;

    setScan({
      code: value,
      scanType,
      order,
      duplicate,
      notFound: !order,
      loading: false,
      detection,
      override: {
        marketplace: order?.marketplace ?? detection.marketplace,
        courier: order?.courier ?? detection.courier,
      },
      verifiedItems: {},
      missingQty: {},
      editingRecordId: null,
    });
  }

  /** Load an existing packing_record back into the scan form for re-editing */
  async function startEdit(recordId: string) {
    const workspace = ws.data?.workspace;
    if (!workspace) return;

    setScan({ ...INITIAL_STATE, loading: true });

    // Fetch the packing record
    const { data: rec, error: recErr } = await supabase
      .from("packing_records")
      .select("*")
      .eq("id", recordId)
      .maybeSingle();

    if (recErr || !rec) {
      toast.error("Could not load packing record for editing.");
      setScan(INITIAL_STATE);
      return;
    }

    // Role gate: Packers can edit ONLY their own submissions.
    if (!canEditRecord(rec.user_id as string)) {
      toast.error("You can only edit packing records that you submitted.");
      setScan(INITIAL_STATE);
      return;
    }

    // Fetch the associated order
    const orderCode = rec.order_number ?? rec.tracking_number ?? rec.raw_code;
    if (!orderCode) {
      toast.error("No order reference found on this record.");
      setScan(INITIAL_STATE);
      return;
    }

    const orClauses = [`order_number.eq.${orderCode}`, `tracking_number.eq.${orderCode}`].join(",");
    const { data: orderRow } = await supabase
      .from("orders")
      .select(
        "id, order_number, tracking_number, marketplace, store_name, courier, customer_name, customer_phone, packing_status, order_status",
      )
      .eq("workspace_id", workspace.id)
      .or(orClauses)
      .limit(1)
      .maybeSingle();

    let order: LookupOrder | null = null;
    if (orderRow) {
      const { data: items } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderRow.id)
        .order("created_at", { ascending: true });
      order = {
        ...orderRow,
        items: (items ?? []).map((it: Record<string, unknown>) => ({
          id: it.id as string,
          sku: (it.sku as string) ?? "",
          sku_marketplace: (it.sku_marketplace as string | null) ?? null,
          sku_master: (it.sku_master as string | null) ?? null,
          product_name: (it.product_name as string) ?? "",
          product_variant: (it.product_variant as string | null) ?? null,
          quantity: (it.quantity as number) ?? 0,
          warehouse_location: (it.warehouse_location as string | null) ?? null,
        })),
      };
    }

    // Restore verified items from the saved record
    const savedVerified: Record<string, boolean> = {};
    const savedMissing: Record<string, number> = {};
    const verifiedSkus: Array<{ item_id: string }> = (rec.verified_skus as Array<{ item_id: string }>) ?? [];
    const missingSkus: Array<{ item_id: string; missing_quantity: number }> =
      (rec.missing_skus as Array<{ item_id: string; missing_quantity: number }>) ?? [];

    for (const vs of verifiedSkus) savedVerified[vs.item_id] = true;
    for (const ms of missingSkus) savedMissing[ms.item_id] = ms.missing_quantity;

    toast.info(`Editing packing record for ${rec.order_number ?? orderCode}`);

    setScan({
      code: rec.raw_code ?? orderCode,
      scanType: "keyboard",
      order,
      duplicate: null, // editing = we own this record
      notFound: !order,
      loading: false,
      detection: null,
      override: {
        marketplace: rec.marketplace ?? order?.marketplace ?? null,
        courier: rec.courier ?? order?.courier ?? null,
      },
      verifiedItems: savedVerified,
      missingQty: savedMissing,
      editingRecordId: recordId,
    });

    // Scroll to the verification panel
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 100);
  }

  function resetScan() {
    setScan(INITIAL_STATE);
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  function toggleVerified(id: string) {
    setScan((s) => ({ ...s, verifiedItems: { ...s.verifiedItems, [id]: !s.verifiedItems[id] } }));
  }

  function verifyAll() {
    if (!scan.order) return;
    const map: Record<string, boolean> = {};
    scan.order.items.forEach((i) => (map[i.id] = true));
    setScan((s) => ({ ...s, verifiedItems: map }));
  }

  const allVerified =
    !!scan.order && scan.order.items.length > 0 && scan.order.items.every((i) => scan.verifiedItems[i.id]);

  function setMissingQty(id: string, qty: number) {
    setScan((s) => ({ ...s, missingQty: { ...s.missingQty, [id]: Math.max(0, qty) } }));
  }

  async function confirmPacking() {
    const order = scan.order;
    const workspace = ws.data?.workspace;
    const userId = ws.data?.userId;
    if (!order || !workspace || !userId) return;
    if (scan.duplicate && !canOverrideDuplicate && !scan.editingRecordId) {
      toast.error("Duplicate — only Owner or Supervisor can confirm.");
      return;
    }
    setSubmitting(true);
    try {
      const me = await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
      const userName = me.data?.full_name || me.data?.email || "Operator";
      const nowIso = new Date().toISOString();
      const device = detectDevice();
      const finalMarketplace = scan.override.marketplace ?? order.marketplace;
      const finalCourier = scan.override.courier ?? order.courier;

      const verifiedSkus = order.items
        .filter((i) => scan.verifiedItems[i.id])
        .map((i) => ({
          item_id: i.id,
          sku_marketplace: i.sku_marketplace ?? i.sku ?? null,
          sku_master: i.sku_master ?? i.sku ?? null,
          quantity: i.quantity,
        }));
      const missingSkus = order.items
        .filter((i) => !scan.verifiedItems[i.id] || (scan.missingQty[i.id] ?? 0) > 0)
        .map((i) => {
          const missing = scan.verifiedItems[i.id] ? Math.min(scan.missingQty[i.id] ?? 0, i.quantity) : i.quantity;
          return {
            item_id: i.id,
            sku_marketplace: i.sku_marketplace ?? i.sku ?? null,
            sku_master: i.sku_master ?? i.sku ?? null,
            ordered_quantity: i.quantity,
            missing_quantity: missing,
          };
        })
        .filter((m) => m.missing_quantity > 0);
      const totalMissing = missingSkus.reduce((sum, m) => sum + m.missing_quantity, 0);
      const completionStatus = totalMissing > 0 ? "Packed with Missing Items" : "Complete";
      const packingStatusValue = totalMissing > 0 ? "Packed with Missing Items" : "Packed";

      const recordPayload = {
        workspace_id: workspace.id,
        user_id: userId,
        user_name: userName,
        role,
        scan_timestamp: nowIso,
        packing_timestamp: nowIso,
        raw_code: scan.editingRecordId
          ? scan.code // keep original raw_code on edit
          : scan.duplicate
            ? `${scan.code}#${Date.now()}`
            : scan.code,
        order_number: order.order_number,
        tracking_number: order.tracking_number,
        marketplace: finalMarketplace,
        courier: finalCourier,
        status: packingStatusValue,
        verified_skus: verifiedSkus,
        missing_skus: missingSkus,
        missing_quantity: totalMissing,
        completion_status: completionStatus,
      };

      let insertedId: string;

      if (scan.editingRecordId) {
        // ── UPDATE existing record ──────────────────────────────────────────
        const { error } = await supabase.from("packing_records").update(recordPayload).eq("id", scan.editingRecordId);

        if (error) {
          toast.error(error.message);
          return;
        }
        insertedId = scan.editingRecordId;
        toast.success(
          totalMissing > 0
            ? `Updated ${order.order_number} — ${totalMissing} missing item${totalMissing === 1 ? "" : "s"}`
            : `Updated packing record for ${order.order_number}`,
        );
      } else {
        // ── INSERT new record ───────────────────────────────────────────────
        const { data: inserted, error } = await supabase
          .from("packing_records")
          .insert(recordPayload)
          .select("id, order_number")
          .single();

        if (error) {
          if (error.code === "23505") {
            toast.warning("Duplicate barcode or tracking number");
            notify({
              type: "scan.duplicate",
              title: "Duplicate scan blocked",
              body: `${order.order_number} — tracking ${order.tracking_number ?? "—"} was already scanned.`,
              severity: "warning",
              link: "/packing",
              roles: ["Supervisor", "Owner"],
              metadata: { order_number: order.order_number, tracking_number: order.tracking_number },
            });
          } else {
            toast.error(error.message);
          }
          return;
        }
        insertedId = inserted.id;
        toast.success(
          totalMissing > 0
            ? `Packed ${order.order_number} with ${totalMissing} missing item${totalMissing === 1 ? "" : "s"}`
            : `Packed ${order.order_number}`,
        );
      }

      // Update the order row to reflect the new packing status
      await supabase
        .from("orders")
        .update({
          packing_status: totalMissing > 0 ? "packed_with_missing" : "packed",
          order_status: packingStatusValue,
          shipping_status: "Packed",
          packed_by: userId,
          packed_by_name: userName,
          packed_at: nowIso,
        })
        .eq("id", order.id);

      await log({
        data: {
          action: scan.editingRecordId ? "packing.updated" : "packing.confirmed",
          target_type: "packing_record",
          target_id: insertedId,
          metadata: {
            order_id: order.id,
            order_number: order.order_number,
            tracking_number: order.tracking_number,
            marketplace: finalMarketplace,
            courier: finalCourier,
            device,
            scan_type: scan.scanType,
            override_duplicate: !!scan.duplicate,
            completion_status: completionStatus,
            missing_quantity: totalMissing,
            missing_skus_count: missingSkus.length,
            edited: !!scan.editingRecordId,
          },
        },
      }).catch(() => undefined);

      qc.invalidateQueries({ queryKey: ["packing_records"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["audit_logs"] });
      resetScan();
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteRecord(id: string) {
    if (!canDelete) return;
    const workspace = ws.data?.workspace;
    if (!workspace) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("packing_records").delete().eq("id", id).eq("workspace_id", workspace.id);

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Packing record deleted.");
      qc.invalidateQueries({ queryKey: ["packing_records"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    lookup(scan.code, "keyboard");
  }

  const totalSku = scan.order?.items.length ?? 0;
  const totalQty = scan.order?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("packing.title")}
        description={t("packing.description")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setCameraOpen(true)}>
              <Camera className="h-4 w-4" /> Camera
            </Button>
            <Button size="sm" onClick={() => codeRef.current?.focus()}>
              <ScanLine className="h-4 w-4" /> Focus scanner
            </Button>
          </>
        }
      />

      {/* ── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Orders — fixed base */}
        <StatCard
          label="Total Orders"
          value={String(kpis.totalOrders)}
          hint={kpis.totalOrders > 0 ? `${kpis.packProgress}% packed` : undefined}
          icon={<PackageCheck className="h-4 w-4" />}
        />

        {/* Pending / In Queue — live countdown: decrements as packs are confirmed */}
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("packing.kpis.inQueue")}
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <PackageCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-2xl font-semibold tracking-tight text-foreground">{kpis.inQueue}</div>
            {kpis.totalOrders > 0 && <span className="text-xs text-muted-foreground">/ {kpis.totalOrders}</span>}
          </div>
          {/* Progress bar: fills as orders get packed */}
          {kpis.totalOrders > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{kpis.packedOrders} packed</span>
                <span>{kpis.inQueue} remaining</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-success transition-all duration-500"
                  style={{ width: `${kpis.packProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <StatCard
          label={t("packing.kpis.activePackers")}
          value={String(kpis.activePackers)}
          icon={<QrCode className="h-4 w-4" />}
        />
        <StatCard label="Packed today" value={String(kpis.packedToday)} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      {/* ── Scan input ─────────────────────────────────────────────────────── */}
      {!scan.editingRecordId && (
        <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 shadow-card space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="raw_code">Scan barcode / QR / tracking number</Label>
              <Input
                id="raw_code"
                ref={codeRef}
                value={scan.code}
                onChange={(e) => setScan((s) => ({ ...s, code: e.target.value }))}
                placeholder="Scan with USB scanner, type, or search…"
                autoFocus
                autoComplete="off"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={scan.loading || !scan.code.trim()}>
                {scan.loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Lookup
              </Button>
            </div>
            <div className="flex items-end">
              <Button type="button" variant="outline" onClick={() => setCameraOpen(true)}>
                <Camera className="h-4 w-4" /> Use camera
              </Button>
            </div>
          </div>
        </form>
      )}

      {scan.notFound && (
        <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-warning" />
            No order matches <span className="font-mono">{scan.code}</span>.
          </div>
          <p className="mt-1 text-muted-foreground">
            Verify the order is imported, or try a different code. Tracking/order numbers must match exactly.
          </p>
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={resetScan}>
              <RefreshCw className="h-4 w-4" /> Rescan
            </Button>
          </div>
        </div>
      )}

      {/* ── Verification panel ─────────────────────────────────────────────── */}
      {scan.order && (
        <div className="rounded-lg border bg-card shadow-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-sm font-semibold">
                {scan.editingRecordId ? "Re-editing packing submission" : "Packing verification"}
              </h3>
              {scan.editingRecordId && (
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600">
                  <Pencil className="h-3 w-3" /> Editing existing record
                </span>
              )}
              <StatusPill tone={statusToTone(scan.order.packing_status.toLowerCase())}>
                {scan.order.packing_status}
              </StatusPill>
              {scan.duplicate && !scan.editingRecordId && (
                <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
                  <AlertTriangle className="h-3 w-3" /> Already packed{" "}
                  {new Date(scan.duplicate.created_at).toLocaleString()} by {scan.duplicate.user_name}
                </span>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {scan.editingRecordId ? "Edit mode" : scan.scanType === "camera" ? "Camera scan" : "Keyboard scan"}
            </span>
          </div>

          <div className="grid gap-4 p-4 md:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Order #</div>
              <div className="font-mono text-sm">{scan.order.order_number}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Tracking #</div>
              <div className="font-mono text-sm">{scan.order.tracking_number ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Customer</div>
              <div className="text-sm">{scan.order.customer_name ?? "—"}</div>
              {scan.order.customer_phone && (
                <div className="text-xs text-muted-foreground">{scan.order.customer_phone}</div>
              )}
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Store</div>
              <div className="text-sm">{scan.order.store_name ?? "—"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Marketplace</div>
              <Select
                value={scan.override.marketplace ?? "_none"}
                onValueChange={(v) =>
                  setScan((s) => ({ ...s, override: { ...s.override, marketplace: v === "_none" ? null : v } }))
                }
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {MARKETPLACES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Courier</div>
              <Select
                value={scan.override.courier ?? "_none"}
                onValueChange={(v) =>
                  setScan((s) => ({ ...s, override: { ...s.override, courier: v === "_none" ? null : v } }))
                }
              >
                <SelectTrigger className="h-8 mt-1">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {COURIERS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total SKUs</div>
              <div className="text-sm font-semibold">{totalSku}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Total items</div>
              <div className="text-sm font-semibold">{totalQty}</div>
            </div>
          </div>

          <div className="overflow-x-auto border-t">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>SKU Marketplace</TableHead>
                  <TableHead>SKU Master</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right w-28">Missing</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scan.order.items.map((it) => {
                  const verified = !!scan.verifiedItems[it.id];
                  const missing = verified ? Math.min(scan.missingQty[it.id] ?? 0, it.quantity) : it.quantity;
                  const rowTone = !verified ? "bg-warning/5" : missing > 0 ? "bg-warning/5" : "bg-success/5";
                  return (
                    <TableRow key={it.id} className={rowTone}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={verified}
                          onChange={() => toggleVerified(it.id)}
                          className="h-4 w-4 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="font-mono text-xs">{it.sku_marketplace ?? it.sku ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {it.sku_master ?? it.sku ?? "—"}
                      </TableCell>
                      <TableCell>{it.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">{it.product_variant ?? "—"}</TableCell>
                      <TableCell className="text-right">{it.quantity}</TableCell>
                      <TableCell className="text-right">
                        {verified ? (
                          <Input
                            type="number"
                            min={0}
                            max={it.quantity}
                            value={scan.missingQty[it.id] ?? 0}
                            onChange={(e) => setMissingQty(it.id, Number(e.target.value) || 0)}
                            className="h-8 w-20 ml-auto text-right"
                          />
                        ) : (
                          <span className="text-xs text-warning font-medium">{it.quantity} missing</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {!scan.order.items.length && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                      No items registered for this order yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-4 py-3">
            <Button variant="ghost" onClick={resetScan} type="button">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button variant="outline" onClick={verifyAll} type="button" disabled={!scan.order.items.length}>
              <CheckCircle2 className="h-4 w-4" /> Verify all
            </Button>
            <Button
              onClick={confirmPacking}
              disabled={submitting || (!!scan.duplicate && !canOverrideDuplicate && !scan.editingRecordId)}
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {scan.editingRecordId
                ? "Save changes"
                : scan.duplicate
                  ? "Override & confirm"
                  : allVerified
                    ? "Confirm packing"
                    : "Confirm with missing items"}
            </Button>
          </div>
        </div>
      )}

      {/* ── Scan history ───────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Scan history</h3>
          <span className="text-xs text-muted-foreground">
            {recordsQuery.isFetching ? "Loading…" : t("common.updatedJustNow")}
          </span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Packer</TableHead>
                <TableHead className="text-right">Status</TableHead>
                {<TableHead className="text-right w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.slice(0, 100).map((r) => {
                const mayEdit = canEditRecord(r.user_id);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {new Date(r.scan_timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.order_number ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.tracking_number ?? "—"}</TableCell>
                    <TableCell>{r.marketplace ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{r.courier ?? "—"}</TableCell>
                    <TableCell>{r.user_name}</TableCell>
                    <TableCell className="text-right">
                      <StatusPill tone={statusToTone(r.status.toLowerCase())}>{r.status}</StatusPill>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {mayEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Re-edit this submission"
                            onClick={() => startEdit(r.id)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Delete this record"
                            onClick={() => setDeleteTarget({ id: r.id, orderNumber: r.order_number ?? r.id })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {!mayEdit && !canDelete && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {!records.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    No scans yet. Use the form above to record your first scan.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* ── Camera scanner dialog ──────────────────────────────────────────── */}
      <CameraScanDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onDetected={(value) => {
          setCameraOpen(false);
          lookup(value, "camera");
        }}
      />

      {/* ── Delete confirmation dialog ────────────────────────────────────── */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete packing record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the packing record for order{" "}
              <span className="font-mono font-semibold">{deleteTarget?.orderNumber}</span>. The order's packing status
              will not be automatically reverted — you may need to re-pack it. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteRecord(deleteTarget.id)}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete record
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CameraScanDialog({
  open,
  onOpenChange,
  onDetected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (value: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean>(true);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    type DetectorCtor = new (opts?: { formats?: string[] }) => {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
    };
    const w = window as unknown as { BarcodeDetector?: DetectorCtor };
    if (!w.BarcodeDetector) {
      setSupported(false);
      setError("Your browser does not support the native barcode detector. Use Chrome on Android, or a USB scanner.");
      return;
    }

    const detector = new w.BarcodeDetector({
      formats: ["qr_code", "code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf"],
    });

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!videoRef.current) return;
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const found = await detector.detect(videoRef.current);
            if (found.length > 0 && found[0].rawValue) {
              onDetected(found[0].rawValue);
              return;
            }
          } catch {
            // ignore decoder errors per frame
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (err) {
        setError((err as Error).message);
      }
    }
    start();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, onDetected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Camera scanner</DialogTitle>
        </DialogHeader>
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">{error}</div>}
        {supported && (
          <div className="overflow-hidden rounded-md border bg-black aspect-video">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
