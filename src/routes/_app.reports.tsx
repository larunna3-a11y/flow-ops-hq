import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, FileText, FileSpreadsheet, FileDown, AlertTriangle, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePackingRecords, useReturns, useWorkspaceMembers } from "@/lib/use-warehouse-data";
import {
  MARKETPLACES,
  COURIERS,
  useStores,
  useDashboardStats,
  usePackingProgress,
  usePackingExceptions,
  type PackingExceptionFilters,
} from "@/lib/use-orders-data";
import { useWorkspace } from "@/lib/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { exportCsv, exportPdf, exportXlsx } from "@/lib/exporters";
import { logActivity } from "@/lib/activity.functions";
import { notify } from "@/lib/notify";

const STATUSES = ["Pending", "Packed", "Shipped", "Cancelled"];

type Preset = "today" | "yesterday" | "week" | "month" | "custom";
function presetRange(p: Preset): { from: string; to: string } {
  const now = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (p === "today") return { from: iso(now), to: iso(now) };
  if (p === "yesterday") {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return { from: iso(y), to: iso(y) };
  }
  if (p === "week") {
    const s = new Date(now);
    s.setDate(now.getDate() - now.getDay());
    return { from: iso(s), to: iso(now) };
  }
  const s = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: iso(s), to: iso(now) };
}

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [
      { title: "Reports — FlowOps" },
      { name: "description", content: "Marketplace, courier and user productivity reports." },
    ],
  }),
  component: ReportsPage,
});

const chartTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

function ReportsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const log = useServerFn(logActivity);
  const initial = presetRange("month");
  const [preset, setPreset] = useState<Preset>("month");
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [marketplace, setMarketplace] = useState("all");
  const [courier, setCourier] = useState("all");
  const [userId, setUserId] = useState("all");
  const [status, setStatus] = useState("all");
  const [storeId, setStoreId] = useState("all");
  const [completeness, setCompleteness] = useState<"all" | "complete" | "incomplete">("all");
  const [tab, setTab] = useState("packing");

  const { data: members = [] } = useWorkspaceMembers();
  const { data: stores = [] } = useStores();
  const { data: records = [] } = usePackingRecords({
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(new Date(to).getTime() + 86400000).toISOString() : undefined,
    marketplace,
    courier,
    userId,
    status,
  });
  const { data: allReturns = [] } = useReturns();

  // ── Live summary — synchronized with the Dashboard's own data source ──────
  // Sources mirror the Dashboard exactly:
  //   totalOrders / pendingOrders → useOrderCounts()  (range-free, shared cache)
  //   packedOrders / shippedOrders / returnedOrders   → useDashboardStats()
  //   todayOrders                                     → usePackingProgress()
  // All three hooks share query keys with Dashboard, so any mutation that
  // invalidates ["order_counts"] / ["dashboard_stats"] / ["packing_progress"]
  // refreshes both pages simultaneously.
  const orderCounts = useOrderCounts();
  const dashboardStats = useDashboardStats();
  const packingProgress = usePackingProgress();
  const liveSummary = {
    totalOrders: orderCounts.data?.totalOrders ?? 0, // ← was dashboardStats (undefined field)
    todayOrders: packingProgress.data?.todayOrders ?? 0,
    pendingOrders: orderCounts.data?.pendingOrders ?? 0, // ← was dashboardStats (undefined field)
    packedOrders: dashboardStats.data?.packedOrders ?? 0, // ← was packingProgress (today-scoped only)
    shippedOrders: dashboardStats.data?.shippedOrders ?? 0,
    returnedOrders: dashboardStats.data?.totalReturns ?? 0,
  };

  // ── Packing Exception Report — live, server-filtered ───────────────────────
  const exceptionFilters: PackingExceptionFilters = useMemo(
    () => ({
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(new Date(to).getTime() + 86400000).toISOString() : undefined,
      marketplace,
      courier,
      storeId,
      packerId: userId,
      completeness,
    }),
    [from, to, marketplace, courier, storeId, userId, completeness],
  );
  const { data: exceptions = [] } = usePackingExceptions(exceptionFilters);
  const exceptionSummary = useMemo(() => {
    const totalPackedOrders = exceptions.length;
    const completePacking = exceptions.filter((e) => e.isComplete).length;
    const incompletePacking = totalPackedOrders - completePacking;
    const totalMissingItems = exceptions.reduce((sum, e) => sum + e.missingQuantity, 0);
    return { totalPackedOrders, completePacking, incompletePacking, totalMissingItems };
  }, [exceptions]);

  // Reports must update automatically after order import, packing confirmation,
  // return processing, and import batch deletion — mirrors the Dashboard's
  // realtime subscription so both pages always reflect the same live data.
  const workspaceId = ws.data?.workspace?.id;
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`reports-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["orders"] });
          qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
          qc.invalidateQueries({ queryKey: ["packing_progress"] });
          qc.invalidateQueries({ queryKey: ["packing_exceptions"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "order_items", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["order_items"] });
          qc.invalidateQueries({ queryKey: ["packing_exceptions"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "packing_records", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["packing_records"] });
          qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
          qc.invalidateQueries({ queryKey: ["packing_progress"] });
          qc.invalidateQueries({ queryKey: ["packing_exceptions"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "returns", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["returns"] });
          qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "imports", filter: `workspace_id=eq.${workspaceId}` },
        () => {
          qc.invalidateQueries({ queryKey: ["imports"] });
          qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
          qc.invalidateQueries({ queryKey: ["packing_progress"] });
          qc.invalidateQueries({ queryKey: ["packing_exceptions"] });
          qc.invalidateQueries({ queryKey: ["orders"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, qc]);

  const returns = useMemo(() => {
    const fromTs = new Date(from).getTime();
    const toTs = new Date(to).getTime() + 86400000;
    return allReturns.filter((r) => {
      const t = new Date(r.created_at).getTime();
      if (t < fromTs || t >= toTs) return false;
      if (marketplace !== "all" && r.marketplace !== marketplace) return false;
      if (courier !== "all" && r.courier !== courier) return false;
      return true;
    });
  }, [allReturns, from, to, marketplace, courier]);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === "custom") return;
    const r = presetRange(p);
    setFrom(r.from);
    setTo(r.to);
  }

  // Packing KPIs
  const packingKpis = useMemo(() => {
    const total = records.length;
    const packed = records.filter((r) => r.status === "Packed" || r.status === "Shipped").length;
    const pending = records.filter((r) => r.status === "Pending").length;
    const failed = records.filter((r) => r.status === "Cancelled").length;
    const times: number[] = [];
    for (const r of records) {
      if (r.packing_timestamp && r.scan_timestamp) {
        const d = new Date(r.packing_timestamp).getTime() - new Date(r.scan_timestamp).getTime();
        if (d > 0 && d < 1000 * 60 * 60 * 8) times.push(d);
      }
    }
    const avgMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : 0;
    return { total, packed, pending, failed, avgSec: Math.round(avgMs / 1000) };
  }, [records]);

  // Return KPIs / breakdowns
  const returnKpis = useMemo(() => {
    const total = returns.length;
    const totalOrders = records.length || 1;
    const rate = (total / totalOrders) * 100;
    let restocked = 0,
      damaged = 0,
      courierClaim = 0,
      supplierClaim = 0;
    const reasonMap = new Map<string, number>();
    for (const r of returns) {
      const res = (r.resolution ?? r.status ?? "").toLowerCase();
      if (res.includes("restock")) restocked += 1;
      if (res.includes("damage")) damaged += 1;
      if (res.includes("courier")) courierClaim += 1;
      if (res.includes("supplier")) supplierClaim += 1;
      const reason = r.reason || "Unspecified";
      reasonMap.set(reason, (reasonMap.get(reason) ?? 0) + 1);
    }
    const reasons = Array.from(reasonMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return { total, rate, restocked, damaged, courierClaim, supplierClaim, reasons };
  }, [returns, records.length]);

  const marketplaceAgg = useMemo(() => {
    const m = new Map<string, { name: string; orders: number; packed: number; returns: number }>();
    for (const r of records) {
      const k = r.marketplace ?? "Unknown";
      const e = m.get(k) ?? { name: k, orders: 0, packed: 0, returns: 0 };
      e.orders += 1;
      if (r.status === "Packed" || r.status === "Shipped") e.packed += 1;
      m.set(k, e);
    }
    for (const r of returns) {
      const k = r.marketplace ?? "Unknown";
      const e = m.get(k) ?? { name: k, orders: 0, packed: 0, returns: 0 };
      e.returns += 1;
      m.set(k, e);
    }
    return Array.from(m.values());
  }, [records, returns]);

  const courierAgg = useMemo(() => {
    const m = new Map<string, { name: string; shipments: number; shipped: number; returns: number; failed: number }>();
    for (const r of records) {
      const k = r.courier ?? "Unknown";
      const e = m.get(k) ?? { name: k, shipments: 0, shipped: 0, returns: 0, failed: 0 };
      e.shipments += 1;
      if (r.status === "Shipped") e.shipped += 1;
      if (r.status === "Cancelled") e.failed += 1;
      m.set(k, e);
    }
    for (const r of returns) {
      const k = r.courier ?? "Unknown";
      const e = m.get(k) ?? { name: k, shipments: 0, shipped: 0, returns: 0, failed: 0 };
      e.returns += 1;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => b.shipments - a.shipments);
  }, [records, returns]);

  const productivity = useMemo(() => {
    const m = new Map<
      string,
      { id: string; name: string; role: string; packed: number; avgSec: number; samples: number }
    >();
    const timeAcc = new Map<string, { sum: number; n: number }>();
    for (const r of records) {
      if (r.status === "Pending" || r.status === "Cancelled") continue;
      const k = r.user_id;
      const e = m.get(k) ?? { id: k, name: r.user_name, role: r.role ?? "—", packed: 0, avgSec: 0, samples: 0 };
      e.packed += 1;
      m.set(k, e);
      if (r.packing_timestamp && r.scan_timestamp) {
        const d = new Date(r.packing_timestamp).getTime() - new Date(r.scan_timestamp).getTime();
        if (d > 0 && d < 1000 * 60 * 60 * 8) {
          const t = timeAcc.get(k) ?? { sum: 0, n: 0 };
          t.sum += d;
          t.n += 1;
          timeAcc.set(k, t);
        }
      }
    }
    for (const [k, t] of timeAcc) {
      const e = m.get(k);
      if (e) {
        e.avgSec = Math.round(t.sum / t.n / 1000);
        e.samples = t.n;
      }
    }
    return Array.from(m.values()).sort((a, b) => b.packed - a.packed);
  }, [records]);

  const returnStaffProductivity = useMemo(() => {
    const m = new Map<string, { name: string; processed: number; completed: number }>();
    for (const r of returns) {
      const k = r.inspector_id || r.assigned_to || "unassigned";
      const name = r.inspector_name || r.assigned_to_name || "Unassigned";
      const e = m.get(k) ?? { name, processed: 0, completed: 0 };
      e.processed += 1;
      if (r.completed_at) e.completed += 1;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => b.processed - a.processed);
  }, [returns]);

  const trendData = useMemo(() => {
    const days: { day: string; packed: number; returns: number }[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push({ day: d.toISOString().slice(5, 10), packed: 0, returns: 0 });
    }
    for (const r of records) {
      if (r.status === "Pending" || r.status === "Cancelled") continue;
      const key = r.created_at.slice(5, 10);
      const d = days.find((x) => x.day === key);
      if (d) d.packed += 1;
    }
    for (const r of returns) {
      const key = r.created_at.slice(5, 10);
      const d = days.find((x) => x.day === key);
      if (d) d.returns += 1;
    }
    return days;
  }, [records, returns, from, to]);

  function fmtDuration(sec: number): string {
    if (!sec) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m ? `${m}m ${s}s` : `${s}s`;
  }

  function currentRows(): Record<string, unknown>[] {
    if (tab === "exceptions") {
      return exceptions.map((e) => ({
        order_number: e.orderNumber,
        tracking_number: e.trackingNumber ?? "",
        customer: e.customerName ?? "",
        marketplace: e.marketplace ?? "",
        store: e.storeName ?? "",
        courier: e.courier ?? "",
        packed_by: e.packedByName ?? "",
        packed_at: e.packedAt ? new Date(e.packedAt).toISOString() : "",
        total_sku: e.totalSku,
        packed_sku: e.packedSku,
        missing_sku: e.missingSku,
        missing_quantity: e.missingQuantity,
        missing_sku_list: e.missingSkuList,
        packing_notes: e.packingNotes,
        completion: e.isComplete ? "Complete" : "Incomplete",
      }));
    }
    if (tab === "returns") {
      return returns.map((r) => ({
        created_at: r.created_at,
        rma: r.rma,
        order_number: r.order_number ?? "",
        marketplace: r.marketplace ?? "",
        courier: r.courier ?? "",
        reason: r.reason ?? "",
        status: r.status,
        resolution: r.resolution ?? "",
        inspector: r.inspector_name ?? "",
      }));
    }
    if (tab === "marketplaces")
      return marketplaceAgg.map((m) => ({
        ...m,
        returnRate: m.orders ? ((m.returns / m.orders) * 100).toFixed(2) + "%" : "0%",
      }));
    if (tab === "couriers")
      return courierAgg.map((c) => ({
        ...c,
        returnRate: c.shipments ? ((c.returns / c.shipments) * 100).toFixed(2) + "%" : "0%",
      }));
    if (tab === "productivity")
      return productivity.map((p) => ({
        user: p.name,
        role: p.role,
        packed: p.packed,
        avg_packing_time_sec: p.avgSec,
      }));
    return records.map((r) => ({
      created_at: new Date(r.created_at).toISOString(),
      order_number: r.order_number ?? "",
      tracking_number: r.tracking_number ?? "",
      marketplace: r.marketplace ?? "",
      courier: r.courier ?? "",
      status: r.status,
      user: r.user_name,
      role: r.role ?? "",
      raw_code: r.raw_code,
    }));
  }

  function exportRows(kind: "xlsx" | "pdf" | "csv") {
    const rows = currentRows();
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `flowops-${tab}-${stamp}`;
    if (kind === "xlsx") exportXlsx(rows, `${base}.xlsx`, tab);
    else if (kind === "csv") exportCsv(rows, `${base}.csv`);
    else exportPdf(rows, `${base}.pdf`, `FlowOps ${tab[0].toUpperCase() + tab.slice(1)} Report`);
    log({
      data: { action: "report.exported", target_type: "report", metadata: { format: kind, rows: rows.length } },
    }).catch(() => undefined);
    notify({
      type: "export.completed",
      title: `Report exported (${kind.toUpperCase()})`,
      body: `${rows.length} rows`,
      severity: "success",
      link: "/reports",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportRows("csv")}>
              <FileDown className="h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportRows("pdf")}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button size="sm" onClick={() => exportRows("xlsx")}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </>
        }
      />

      {/* Live summary — same source & business rules as the Dashboard, so these
          numbers always match what's shown there. */}
      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Live overview</h3>
          <span className="text-xs text-muted-foreground">Synced with Dashboard</span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total Orders" value={liveSummary.totalOrders} />
          <KpiCard label="Today's Orders" value={liveSummary.todayOrders} />
          <KpiCard label="Pending Orders" value={liveSummary.pendingOrders} />
          <KpiCard label="Packed Orders" value={liveSummary.packedOrders} />
          <KpiCard label="Shipped Orders" value={liveSummary.shippedOrders} />
          <KpiCard label="Returned Orders" value={liveSummary.returnedOrders} />
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-7">
          <div className="space-y-1.5">
            <Label>Range</Label>
            <Select value={preset} onValueChange={(v) => applyPreset(v as Preset)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPreset("custom");
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPreset("custom");
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Marketplace</Label>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MARKETPLACES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Courier</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {COURIERS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{tab === "exceptions" ? "Packer" : "User"}</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {tab === "exceptions" ? (
            <>
              <div className="space-y-1.5">
                <Label>Store</Label>
                <Select value={storeId} onValueChange={setStoreId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {stores.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Packing completeness</Label>
                <Select value={completeness} onValueChange={(v) => setCompleteness(v as typeof completeness)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="complete">Complete Packing</SelectItem>
                    <SelectItem value="incomplete">Incomplete Packing Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {STATUSES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          <Download className="inline h-3 w-3 mr-1" />
          {tab === "exceptions"
            ? `${exceptions.length} packed orders in range.`
            : `${records.length} packing records · ${returns.length} returns in range.`}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="packing">Packing</TabsTrigger>
          <TabsTrigger value="exceptions">Packing Exceptions</TabsTrigger>
          <TabsTrigger value="returns">Returns</TabsTrigger>
          <TabsTrigger value="marketplaces">{t("reports.tabs.marketplaces")}</TabsTrigger>
          <TabsTrigger value="couriers">{t("reports.tabs.couriers")}</TabsTrigger>
          <TabsTrigger value="productivity">{t("reports.tabs.productivity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="exceptions" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <KpiCard label="Total Packed Orders" value={exceptionSummary.totalPackedOrders} />
            <KpiCard label="Complete Packing" value={exceptionSummary.completePacking} />
            <KpiCard label="Incomplete Packing" value={exceptionSummary.incompletePacking} />
            <KpiCard label="Total Missing Items" value={exceptionSummary.totalMissingItems} />
          </div>
          <div className="rounded-lg border bg-card shadow-card overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order Number</TableHead>
                  <TableHead>Tracking Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Packed By</TableHead>
                  <TableHead>Packed At</TableHead>
                  <TableHead className="text-right">Total SKU</TableHead>
                  <TableHead className="text-right">Packed SKU</TableHead>
                  <TableHead className="text-right">Missing SKU</TableHead>
                  <TableHead className="text-right">Missing Qty</TableHead>
                  <TableHead>Missing SKU List</TableHead>
                  <TableHead>Packing Notes</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exceptions.map((e) => (
                  <TableRow key={e.orderId}>
                    <TableCell className="font-medium whitespace-nowrap">{e.orderNumber}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.trackingNumber ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.customerName ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.marketplace ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.storeName ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.courier ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap">{e.packedByName ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {e.packedAt ? new Date(e.packedAt).toLocaleString() : "—"}
                    </TableCell>
                    <TableCell className="text-right">{e.totalSku}</TableCell>
                    <TableCell className="text-right">{e.packedSku}</TableCell>
                    <TableCell className="text-right">{e.missingSku}</TableCell>
                    <TableCell className="text-right">{e.missingQuantity}</TableCell>
                    <TableCell className="max-w-xs truncate" title={e.missingSkuList}>
                      {e.missingSkuList || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={e.packingNotes}>
                      {e.packingNotes || "—"}
                    </TableCell>
                    <TableCell>
                      {e.isComplete ? (
                        <Badge variant="secondary" className="gap-1">
                          <PackageCheck className="h-3 w-3" /> Complete
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" /> Incomplete
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!exceptions.length && (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center text-sm text-muted-foreground py-8">
                      No packed orders for the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="packing" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-5">
            <KpiCard label="Total orders" value={packingKpis.total} />
            <KpiCard label="Packed" value={packingKpis.packed} />
            <KpiCard label="Pending" value={packingKpis.pending} />
            <KpiCard label="Failed packing" value={packingKpis.failed} />
            <KpiCard label="Avg packing time" value={fmtDuration(packingKpis.avgSec)} />
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Packing trend</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="packed" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="returns" stroke="var(--chart-3)" strokeWidth={2.5} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="returns" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <KpiCard label="Total returns" value={returnKpis.total} />
            <KpiCard label="Return rate" value={`${returnKpis.rate.toFixed(2)}%`} />
            <KpiCard label="Restocked" value={returnKpis.restocked} />
            <KpiCard label="Damaged" value={returnKpis.damaged} />
            <KpiCard label="Courier claims" value={returnKpis.courierClaim} />
            <KpiCard label="Supplier claims" value={returnKpis.supplierClaim} />
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Return reasons</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={returnKpis.reasons.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={140}
                  />
                  <Tooltip contentStyle={chartTooltip} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {returnKpis.reasons.slice(0, 10).map((_, i) => (
                      <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>RMA</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resolution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.slice(0, 50).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.rma}</TableCell>
                    <TableCell>{r.order_number ?? "—"}</TableCell>
                    <TableCell>{r.marketplace ?? "—"}</TableCell>
                    <TableCell>{r.reason ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{r.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.resolution ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {!returns.length && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                      No returns in range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="marketplaces" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Marketplace performance</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketplaceAgg}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="packed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="returns" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marketplace</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Packed</TableHead>
                  <TableHead className="text-right">Returns</TableHead>
                  <TableHead className="text-right">Return rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketplaceAgg.map((m) => (
                  <TableRow key={m.name}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{m.orders.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{m.packed}</TableCell>
                    <TableCell className="text-right">{m.returns}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {m.orders ? ((m.returns / m.orders) * 100).toFixed(2) : "0.00"}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="couriers" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Courier performance</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courierAgg} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    type="number"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    width={100}
                  />
                  <Tooltip contentStyle={chartTooltip} />
                  <Bar dataKey="shipments" radius={[0, 4, 4, 0]}>
                    {courierAgg.map((_, i) => (
                      <Cell key={i} fill={`var(--chart-${(i % 5) + 1})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courier</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead className="text-right">Shipped</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead className="text-right">Returns</TableHead>
                  <TableHead className="text-right">Return rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courierAgg.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.shipments.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{c.shipped}</TableCell>
                    <TableCell className="text-right">{c.failed}</TableCell>
                    <TableCell className="text-right">{c.returns}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {c.shipments ? ((c.returns / c.shipments) * 100).toFixed(2) : "0.00"}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="productivity" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <KpiCard label="Total packed (range)" value={packingKpis.packed} />
            <KpiCard label="Avg packing time" value={fmtDuration(packingKpis.avgSec)} />
            <KpiCard label="Returns processed" value={returnKpis.total} />
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Daily packing trend</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="day"
                    stroke="var(--muted-foreground)"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Line type="monotone" dataKey="packed" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-card">
            <div className="px-4 py-3 border-b text-sm font-semibold">Top packers</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Items packed</TableHead>
                  <TableHead className="text-right">Avg time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.map((u, i) => (
                  <TableRow key={u.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{u.role}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{u.packed}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{fmtDuration(u.avgSec)}</TableCell>
                  </TableRow>
                ))}
                {!productivity.length && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                      No data for current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-lg border bg-card shadow-card">
            <div className="px-4 py-3 border-b text-sm font-semibold">Top return staff</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Processed</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnStaffProductivity.map((u, i) => (
                  <TableRow key={u.name + i}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="text-right">{u.processed}</TableCell>
                    <TableCell className="text-right">{u.completed}</TableCell>
                  </TableRow>
                ))}
                {!returnStaffProductivity.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                      No return activity in range.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
