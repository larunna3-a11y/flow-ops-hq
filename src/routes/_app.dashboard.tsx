import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PackageCheck,
  ScanLine,
  RotateCcw,
  TrendingUp,
  Truck,
  ArrowRight,
  Users,
  UserCheck,
  ShoppingCart,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  usePackingRecords,
  useReturns,
  useAuditLogs,
  useWorkspaceMembers,
} from "@/lib/use-warehouse-data";
import { useOrders, useStores, useImports } from "@/lib/use-orders-data";
import { useWorkspace } from "@/lib/use-workspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FlowOps" },
      { name: "description", content: "Operational overview, packing performance, returns and user activity." },
    ],
  }),
  component: DashboardPage,
});

const pieColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

type Preset = "today" | "week" | "month" | "custom";

function rangeFor(preset: Preset, customFrom?: string, customTo?: string) {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (preset === "week") start.setDate(now.getDate() - 6);
  if (preset === "month") start.setDate(1);
  if (preset === "custom") {
    if (customFrom) start.setTime(new Date(customFrom + "T00:00:00").getTime());
    if (customTo) end.setTime(new Date(customTo + "T23:59:59").getTime());
  }
  return { from: start.toISOString(), to: end.toISOString() };
}

function DashboardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();

  const [preset, setPreset] = useState<Preset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const records = usePackingRecords({ from: range.from, to: range.to });
  const recordsAll = usePackingRecords();
  const returns = useReturns();
  const activity = useAuditLogs(12);
  const orders = useOrders();
  const stores = useStores();
  const imports = useImports();
  const members = useWorkspaceMembers();

  // Realtime: invalidate relevant queries when any source table changes for this workspace.
  const workspaceId = ws.data?.workspace?.id;
  useEffect(() => {
    if (!workspaceId) return;
    const channel = supabase
      .channel(`dashboard-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "packing_records", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["packing_records"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "returns", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["returns"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["order_items"] });
        qc.invalidateQueries({ queryKey: ["orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "imports", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["imports"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "audit_logs", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["audit_logs"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "users", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["workspace_members"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "roles", filter: `workspace_id=eq.${workspaceId}` }, () => {
        qc.invalidateQueries({ queryKey: ["workspace_members"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, qc]);

  const data = records.data ?? [];
  const ret = returns.data ?? [];
  const ord = orders.data ?? [];
  const mem = members.data ?? [];

  const stats = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayIso = todayStart.toISOString();

    const packed = data.filter((r) => r.status !== "Pending" && r.status !== "Cancelled").length;
    const pending = data.filter((r) => r.status === "Pending").length;
    const activePackers = new Set(data.map((r) => r.user_id)).size;

    const ordersInRange = ord.filter((o) => o.created_at >= range.from && o.created_at <= range.to).length;
    const returnsInRange = ret.filter((r) => r.created_at >= range.from && r.created_at <= range.to).length;

    const activeUsers = new Set(
      (activity.data ?? [])
        .filter((a) => a.created_at >= todayIso && a.actor_id)
        .map((a) => a.actor_id as string),
    ).size;

    return {
      ordersInRange,
      packed,
      pending,
      returnsInRange,
      activePackers,
      activeUsers,
    };
  }, [data, ret, ord, range, activity.data]);

  const roleSummary = useMemo(() => {
    const counts: Record<string, number> = { Owner: 0, Supervisor: 0, Packer: 0, "Return Staff": 0 };
    for (const u of mem) if (u.role && counts[u.role] !== undefined) counts[u.role] += 1;
    return {
      total: mem.length,
      active: mem.filter((u) => u.status === "active").length,
      Owner: counts.Owner,
      Supervisor: counts.Supervisor,
      Packer: counts.Packer,
      ReturnStaff: counts["Return Staff"],
    };
  }, [mem]);


  const marketplaceData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data) {
      const k = r.marketplace ?? "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m, ([name, orders]) => ({ name, orders }));
  }, [data]);

  const courierData = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of data) {
      const k = r.courier ?? "Unknown";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m, ([name, shipments]) => ({ name, shipments })).sort((a, b) => b.shipments - a.shipments);
  }, [data]);

  const trendData = useMemo(() => {
    const days: { day: string; packed: number; date: string }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ day: DAY_LABELS[d.getDay()], date: d.toISOString().slice(0, 10), packed: 0 });
    }
    const all = recordsAll.data ?? [];
    for (const r of all) {
      const key = r.created_at.slice(0, 10);
      const day = days.find((d) => d.date === key);
      if (day && r.status !== "Pending" && r.status !== "Cancelled") day.packed += 1;
    }
    return days;
  }, [recordsAll.data]);

  const returnStats = useMemo(() => {
    const buckets = { received: 0, inspecting: 0, restocked: 0, rejected: 0 } as Record<string, number>;
    for (const r of ret) {
      if (r.created_at >= range.from && r.created_at <= range.to) {
        buckets[r.status] = (buckets[r.status] ?? 0) + 1;
      }
    }
    return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [ret, range]);

  const userActivityData = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of activity.data ?? []) {
      const name = a.actor_name ?? "System";
      map.set(name, (map.get(name) ?? 0) + 1);
    }
    return Array.from(map, ([name, actions]) => ({ name, actions }))
      .sort((a, b) => b.actions - a.actions)
      .slice(0, 6);
  }, [activity.data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <>
            <div className="flex items-center gap-1 rounded-md border bg-card p-1">
              {(["today", "week", "month", "custom"] as Preset[]).map((p) => (
                <Button
                  key={p}
                  size="sm"
                  variant={preset === p ? "default" : "ghost"}
                  onClick={() => setPreset(p)}
                  className="h-7 px-2 text-xs capitalize"
                >
                  {p}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-8 w-36 text-xs" />
                <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-8 w-36 text-xs" />
              </div>
            )}
            <Button size="sm" asChild><Link to="/reports">{t("common.exportReport")}</Link></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <StatCard label="Total orders" value={String(stats.ordersInRange)} icon={<ShoppingCart className="h-4 w-4" />} />
        <StatCard label="Packed" value={String(stats.packed)} icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label="Pending orders" value={String(stats.pending)} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Total returns" value={String(stats.returnsInRange)} icon={<RotateCcw className="h-4 w-4" />} />
        <StatCard label="Active packers" value={String(stats.activePackers)} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active users" value={String(stats.activeUsers)} icon={<UserCheck className="h-4 w-4" />} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label={t("dashboard.orders.total")}
          value={String(ord.length)}
          icon={<ShoppingCart className="h-4 w-4" />}
        />
        <StatCard
          label={t("dashboard.orders.ready")}
          value={String(
            ord.filter((o) => o.packing_status === "ready" || o.packing_status === "assigned").length,
          )}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          label={t("dashboard.orders.packing")}
          value={String(ord.filter((o) => o.packing_status === "packing").length)}
          icon={<ScanLine className="h-4 w-4" />}
        />
        <StatCard
          label={t("dashboard.orders.packed")}
          value={String(ord.filter((o) => o.packing_status === "packed").length)}
          icon={<PackageCheck className="h-4 w-4" />}
        />
        <StatCard
          label={t("dashboard.orders.shipped")}
          value={String(ord.filter((o) => o.packing_status === "shipped").length)}
          icon={<Truck className="h-4 w-4" />}
        />
      </div>


      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Daily packing trend</h3>
              <p className="text-xs text-muted-foreground">Last 7 days</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-success">
              <TrendingUp className="h-3.5 w-3.5" /> Live
            </span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="packed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} />
                <Area type="monotone" dataKey="packed" stroke="var(--chart-1)" strokeWidth={2} fill="url(#packed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold text-foreground">Orders by marketplace</h3>
          <p className="text-xs text-muted-foreground">Selected range</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={marketplaceData} dataKey="orders" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={3} stroke="var(--card)">
                  {marketplaceData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
                </Pie>
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold">Orders by courier</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={courierData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} />
                <Bar dataKey="shipments" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card shadow-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h3 className="text-sm font-semibold">{t("dashboard.activity.title")}</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/users">{t("dashboard.activity.team")} <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <ul className="divide-y max-h-80 overflow-y-auto">
            {(activity.data ?? []).map((a) => {
              const mod = (a.action.split(".")[0] ?? "system");
              return (
                <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex-1 text-sm min-w-0">
                    <div className="truncate">
                      <span className="font-medium">{a.actor_name ?? "System"}</span>{" "}
                      <span className="text-muted-foreground">{a.action}</span>
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{mod}</div>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleTimeString()}</span>
                </li>
              );
            })}
            {!(activity.data ?? []).length && (
              <li className="px-5 py-6 text-center text-sm text-muted-foreground">No activity yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold">Return statistics</h3>
          <p className="text-xs text-muted-foreground">Selected range</p>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={returnStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} />
                <Bar dataKey="value" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold">User activity</h3>
          <p className="text-xs text-muted-foreground">Top actors (recent)</p>
          <div className="mt-2 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userActivityData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} width={110} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--popover-foreground)" }} />
                <Bar dataKey="actions" fill="var(--chart-4)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold">User summary</h3>
          <p className="text-xs text-muted-foreground">Workspace members</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Total users</dt><dd className="font-medium">{roleSummary.total}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Active users</dt><dd className="font-medium">{roleSummary.active}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Owners</dt><dd className="font-medium">{roleSummary.Owner}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Supervisors</dt><dd className="font-medium">{roleSummary.Supervisor}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Packers</dt><dd className="font-medium">{roleSummary.Packer}</dd></div>
            <div className="flex items-center justify-between"><dt className="text-muted-foreground">Return staff</dt><dd className="font-medium">{roleSummary.ReturnStaff}</dd></div>
          </dl>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div>
            <h3 className="text-sm font-semibold">Recent packing records</h3>
            <p className="text-xs text-muted-foreground">Latest scans across stations</p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/packing">Open queue <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
          </Button>
        </div>
        <div className="divide-y">
          {data.slice(0, 6).map((o) => (
            <div key={o.id} className="flex items-center gap-4 px-5 py-3 text-sm">
              <div className="font-mono text-xs text-muted-foreground w-44 truncate">{o.order_number ?? o.raw_code}</div>
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{o.marketplace ?? "—"} · {o.courier ?? "—"}</div>
                <div className="text-xs text-muted-foreground">
                  {o.user_name} · {new Date(o.created_at).toLocaleString()}
                </div>
              </div>
              <StatusPill tone={statusToTone(o.status.toLowerCase())}>{o.status}</StatusPill>
            </div>
          ))}
          {!data.length && (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">
              No packing records in the selected range. Head to <Link to="/scanning" className="text-primary underline">Scan</Link> to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
