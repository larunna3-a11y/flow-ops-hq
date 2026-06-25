import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
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
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  usePackingRecords,
  useReturns,
  useAuditLogs,
} from "@/lib/use-warehouse-data";
import { useOrders, useStores, useImports } from "@/lib/use-orders-data";
import { useWorkspace } from "@/lib/use-workspace";
import { seedDemoData } from "@/lib/demo-seed.functions";
import { seedSprint2 } from "@/lib/sprint2-seed.functions";

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

function DashboardPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const seed = useServerFn(seedDemoData);
  const seedS2 = useServerFn(seedSprint2);
  const records = usePackingRecords();
  const returns = useReturns();
  const activity = useAuditLogs(8);
  const orders = useOrders();
  const stores = useStores();
  const imports = useImports();

  // Auto-seed demo data for owners on first visit if empty.
  useEffect(() => {
    if (
      ws.data?.role === "Owner" &&
      records.isSuccess &&
      records.data.length === 0 &&
      returns.isSuccess &&
      returns.data.length === 0
    ) {
      seed()
        .then(() => {
          qc.invalidateQueries({ queryKey: ["packing_records"] });
          qc.invalidateQueries({ queryKey: ["returns"] });
          qc.invalidateQueries({ queryKey: ["audit_logs"] });
        })
        .catch(() => undefined);
    }
  }, [ws.data?.role, records.isSuccess, records.data?.length, returns.isSuccess, returns.data?.length, seed, qc]);

  const data = records.data ?? [];
  const ret = returns.data ?? [];

  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const todayIso = today.toISOString();
    const monthIso = monthStart.toISOString();

    const packedToday = data.filter((r) => r.created_at >= todayIso && r.status !== "Pending" && r.status !== "Cancelled").length;
    const packedMonth = data.filter((r) => r.created_at >= monthIso && r.status !== "Pending" && r.status !== "Cancelled").length;
    const pending = data.filter((r) => r.status === "Pending").length;
    const activePackers = new Set(data.filter((r) => r.created_at >= todayIso).map((r) => r.user_id)).size;
    return { packedToday, packedMonth, pending, activePackers, totalReturns: ret.length };
  }, [data, ret]);

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
    for (const r of data) {
      const key = r.created_at.slice(0, 10);
      const day = days.find((d) => d.date === key);
      if (day && r.status !== "Pending" && r.status !== "Cancelled") day.packed += 1;
    }
    return days;
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.description")}
        actions={
          <>
            <Button variant="outline" size="sm">{t("common.last7Days")}</Button>
            <Button size="sm" asChild><Link to="/reports">{t("common.exportReport")}</Link></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Packed today" value={String(stats.packedToday)} icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label="Packed this month" value={String(stats.packedMonth)} icon={<ScanLine className="h-4 w-4" />} />
        <StatCard label="Pending orders" value={String(stats.pending)} icon={<Truck className="h-4 w-4" />} />
        <StatCard label="Total returns" value={String(stats.totalReturns)} icon={<RotateCcw className="h-4 w-4" />} />
        <StatCard label="Active packers" value={String(stats.activePackers)} icon={<Users className="h-4 w-4" />} />
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
          <p className="text-xs text-muted-foreground">All scans</p>
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
            {(activity.data ?? []).map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{a.actor_name ?? "System"}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.created_at).toLocaleTimeString()}</span>
              </li>
            ))}
            {!(activity.data ?? []).length && (
              <li className="px-5 py-6 text-center text-sm text-muted-foreground">No activity yet.</li>
            )}
          </ul>
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
              No packing records yet. Head to <Link to="/scanning" className="text-primary underline">Scan</Link> to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
