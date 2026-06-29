import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Search, Sparkles, Activity, Users as UsersIcon, Package, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";
import { usePackingRecords, useReturns, useWorkspaceMembers, type AuditLog } from "@/lib/use-warehouse-data";

const MARKETPLACES = ["Shopee", "TikTok Shop", "Tokopedia", "Lazada", "Blibli"];
const COURIERS = [
  "J&T Express",
  "SPX Express",
  "ID Express",
  "AnterAja",
  "SiCepat",
  "Ninja Xpress",
  "GoTo Logistics",
  "Lazada Express",
];

const chartTooltip = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
  color: "var(--popover-foreground)",
};

export const Route = createFileRoute("/_app/operations")({
  head: () => ({
    meta: [
      { title: "Operations Intelligence — FlowOps" },
      {
        name: "description",
        content: "Audit Center, operational KPIs, performance analytics and warehouse activity timeline.",
      },
    ],
  }),
  component: OperationsPage,
});

// Derive a human module label from the action string ("packing.confirmed" → "Packing").
function moduleOf(action: string): string {
  const seg = action.split(".")[0] || "system";
  const map: Record<string, string> = {
    user: "Auth",
    member: "Users",
    role: "Users",
    invitation: "Users",
    order: "Orders",
    packing: "Packing",
    scan: "Scanning",
    return: "Returns",
    report: "Reports",
    integration: "Integrations",
    import: "Imports",
    detection: "Detection",
    workspace: "Settings",
    settings: "Settings",
    store: "Stores",
  };
  return map[seg] ?? seg.charAt(0).toUpperCase() + seg.slice(1);
}

function describe(log: AuditLog): string {
  const m = (log.metadata ?? {}) as Record<string, unknown>;
  const parts: string[] = [];
  if (log.target_type && log.target_id) parts.push(`${log.target_type}: ${log.target_id}`);
  for (const k of ["order_number", "tracking_number", "marketplace", "courier", "filename", "rma"]) {
    if (m[k]) parts.push(`${k}: ${m[k]}`);
  }
  return parts.join(" · ") || "—";
}

function deviceFromUA(ua: string | null | undefined): string {
  if (!ua) return "—";
  const s = ua.toLowerCase();
  if (s.includes("android")) return "Android";
  if (s.includes("iphone") || s.includes("ios")) return "iOS";
  if (s.includes("mac os")) return "macOS";
  if (s.includes("windows")) return "Windows";
  if (s.includes("linux")) return "Linux";
  return "Web";
}

function OperationsPage() {
  const ws = useWorkspace();
  const role = ws.data?.role;
  if (role && role !== "Owner" && role !== "Supervisor") {
    return <Navigate to="/dashboard" />;
  }
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Intelligence"
        description="Live audit trail, KPIs and performance analytics across the warehouse."
      />

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">
            <Activity className="h-3.5 w-3.5" /> Audit Center
          </TabsTrigger>
          <TabsTrigger value="kpis">
            <Package className="h-3.5 w-3.5" /> KPI Dashboard
          </TabsTrigger>
          <TabsTrigger value="performance">
            <UsersIcon className="h-3.5 w-3.5" /> Performance
          </TabsTrigger>
          <TabsTrigger value="timeline">
            <Search className="h-3.5 w-3.5" /> Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audit">
          <AuditCenter />
        </TabsContent>
        <TabsContent value="kpis">
          <KpiDashboard />
        </TabsContent>
        <TabsContent value="performance">
          <PerformanceAnalytics />
        </TabsContent>
        <TabsContent value="timeline">
          <AuditTimeline />
        </TabsContent>
      </Tabs>

      <section className="rounded-lg border border-dashed bg-card/50 p-4">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">AI insights & predictive analytics — Coming Soon</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl">
              Operations Intelligence is wired to live warehouse data and ready for predictive packing forecasts,
              return-risk scoring and anomaly detection. No AI is enabled yet.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Audit Center ---------- */

function AuditCenter() {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  const members = useWorkspaceMembers();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userId, setUserId] = useState<string>("all");
  const [moduleFilter, setModuleFilter] = useState<string>("all");
  const [actionSearch, setActionSearch] = useState("");

  const logs = useQuery({
    queryKey: ["ops_audit", wid, from, to, userId, moduleFilter, actionSearch],
    enabled: !!wid,
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("*")
        .eq("workspace_id", wid!)
        .order("created_at", { ascending: false })
        .limit(50000);
      if (from) q = q.gte("created_at", `${from}T00:00:00.000Z`);
      if (to) q = q.lte("created_at", `${to}T23:59:59.999Z`);
      if (userId !== "all") q = q.eq("actor_id", userId);
      if (actionSearch.trim()) q = q.ilike("action", `%${actionSearch.trim()}%`);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as AuditLog[];
      const ids = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean) as string[]));
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
        const map = new Map((profs ?? []).map((p) => [p.id, p.full_name || p.email]));
        for (const r of rows) r.actor_name = r.actor_id ? (map.get(r.actor_id) ?? null) : null;
      }
      return rows;
    },
  });

  const filtered = useMemo(() => {
    const rows = logs.data ?? [];
    if (moduleFilter === "all") return rows;
    return rows.filter((r) => moduleOf(r.action) === moduleFilter);
  }, [logs.data, moduleFilter]);

  const modules = useMemo(() => {
    const set = new Set<string>();
    (logs.data ?? []).forEach((r) => set.add(moduleOf(r.action)));
    return Array.from(set).sort();
  }, [logs.data]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {(members.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Module</Label>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {modules.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Action contains</Label>
            <Input placeholder="e.g. packing" value={actionSearch} onChange={(e) => setActionSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Module</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>IP</TableHead>
              <TableHead>Device</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.slice(0, 500).map((l) => {
              const m = (l.metadata ?? {}) as Record<string, unknown>;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                  <TableCell className="text-xs">{l.actor_name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{moduleOf(l.action)}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell className="text-xs">{describe(l)}</TableCell>
                  <TableCell className="font-mono text-xs">{(m.ip as string) || "—"}</TableCell>
                  <TableCell className="text-xs">{deviceFromUA(m.user_agent as string | undefined)}</TableCell>
                </TableRow>
              );
            })}
            {!filtered.length && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {logs.isLoading ? "Loading…" : "No activity matches the current filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

/* ---------- KPI Dashboard ---------- */

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function startOfWeek(d: Date) {
  const s = new Date(d);
  s.setDate(d.getDate() - d.getDay());
  s.setHours(0, 0, 0, 0);
  return s;
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function KpiDashboard() {
  const packs = usePackingRecords();
  const returns = useReturns();
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;

  const orderCounts = useQuery({
    queryKey: ["ops_order_counts", wid],
    enabled: !!wid,
    queryFn: async () => {
      const statuses = ["new", "ready", "packing", "packed", "shipped", "delivered", "returned", "cancelled"];
      const out: Record<string, number> = {};
      for (const s of statuses) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { count } = await (supabase.from("orders") as any)
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", wid!)
          .eq("packing_status", s);
        out[s] = count ?? 0;
      }
      return out;
    },
  });

  const now = new Date();
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);

  const packed = (packs.data ?? []).filter((r) => r.status === "Packed");
  const packedToday = packed.filter((r) => isSameDay(new Date(r.packing_timestamp || r.created_at), now)).length;
  const packedWeek = packed.filter((r) => new Date(r.packing_timestamp || r.created_at) >= weekStart).length;
  const packedMonth = packed.filter((r) => new Date(r.packing_timestamp || r.created_at) >= monthStart).length;

  const avgPackingMs = (() => {
    const samples = packed
      .filter((r) => r.packing_timestamp && r.scan_timestamp)
      .map((r) => new Date(r.packing_timestamp!).getTime() - new Date(r.scan_timestamp).getTime())
      .filter((d) => d > 0 && d < 1000 * 60 * 30);
    if (!samples.length) return 0;
    return samples.reduce((a, b) => a + b, 0) / samples.length;
  })();
  const avgPackingSec = Math.round(avgPackingMs / 1000);

  const totalScans = (packs.data ?? []).length;
  const failedScans = (packs.data ?? []).filter((r) => r.status === "Cancelled").length;
  const accuracy = totalScans ? Math.round(((totalScans - failedScans) / totalScans) * 100) : 100;

  // Duplicate scan rate: same raw_code seen ≥2× per user.
  const dupRate = (() => {
    const seen = new Map<string, number>();
    for (const r of packs.data ?? []) {
      const k = `${r.user_id}|${r.raw_code}`;
      seen.set(k, (seen.get(k) ?? 0) + 1);
    }
    const dupes = Array.from(seen.values())
      .filter((v) => v > 1)
      .reduce((a, b) => a + (b - 1), 0);
    return totalScans ? Math.round((dupes / totalScans) * 100) : 0;
  })();

  const topPackers = useMemo(() => {
    const m = new Map<string, { name: string; count: number; sum: number; samples: number }>();
    for (const r of packed) {
      const cur = m.get(r.user_id) ?? { name: r.user_name, count: 0, sum: 0, samples: 0 };
      cur.count += 1;
      if (r.packing_timestamp && r.scan_timestamp) {
        const d = new Date(r.packing_timestamp).getTime() - new Date(r.scan_timestamp).getTime();
        if (d > 0 && d < 1000 * 60 * 30) {
          cur.sum += d;
          cur.samples += 1;
        }
      }
      m.set(r.user_id, cur);
    }
    return Array.from(m.values())
      .map((u) => ({ ...u, avgSec: u.samples ? Math.round(u.sum / u.samples / 1000) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [packed]);

  const dailyTrend = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      m.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of packed) {
      const k = new Date(r.packing_timestamp || r.created_at).toISOString().slice(0, 10);
      if (m.has(k)) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries()).map(([day, packed]) => ({ day: day.slice(5), packed }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packed]);

  /* Returns KPIs */
  const rets = returns.data ?? [];
  const completed = rets.filter((r) => r.completed_at);
  const avgResolutionHrs = (() => {
    const samples = completed
      .map((r) => new Date(r.completed_at!).getTime() - new Date(r.received_at).getTime())
      .filter((d) => d > 0);
    if (!samples.length) return 0;
    return Math.round((samples.reduce((a, b) => a + b, 0) / samples.length / (1000 * 60 * 60)) * 10) / 10;
  })();
  const restocked = rets.filter((r) => (r.resolution || "").toLowerCase().includes("restock")).length;
  const claimed = rets.filter((r) => (r.resolution || "").toLowerCase().includes("claim")).length;
  const restockRate = rets.length ? Math.round((restocked / rets.length) * 100) : 0;
  const claimRate = rets.length ? Math.round((claimed / rets.length) * 100) : 0;
  const reasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rets) m.set(r.reason || "Unknown", (m.get(r.reason || "Unknown") ?? 0) + 1);
    return Array.from(m.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [rets]);

  const oc = orderCounts.data ?? {};

  return (
    <div className="space-y-6">
      {/* Warehouse overview */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Warehouse overview</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total orders" value={Object.values(oc).reduce((a, b) => a + (b as number), 0)} />
          <StatCard label="Pending" value={(oc.new ?? 0) + (oc.ready ?? 0) + (oc.packing ?? 0)} />
          <StatCard label="Packed" value={oc.packed ?? 0} />
          <StatCard label="Completed" value={(oc.shipped ?? 0) + (oc.delivered ?? 0)} />
          <StatCard label="Returned" value={oc.returned ?? 0} />
        </div>
      </section>

      {/* Packing KPIs */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Packing team</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Packed today" value={packedToday} />
          <StatCard label="Packed this week" value={packedWeek} />
          <StatCard label="Packed this month" value={packedMonth} />
          <StatCard label="Avg packing time" value={avgPackingSec ? `${avgPackingSec}s` : "—"} />
          <StatCard label="Packing accuracy" value={`${accuracy}%`} />
          <StatCard label="Duplicate scan rate" value={`${dupRate}%`} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-4 shadow-card">
            <div className="text-xs font-semibold mb-2">Top packers</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Packer</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Avg time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topPackers.map((p) => (
                  <TableRow key={p.name}>
                    <TableCell className="text-xs">{p.name}</TableCell>
                    <TableCell className="text-right text-xs">{p.count}</TableCell>
                    <TableCell className="text-right text-xs">{p.avgSec ? `${p.avgSec}s` : "—"}</TableCell>
                  </TableRow>
                ))}
                {!topPackers.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-xs text-muted-foreground py-4">
                      No packing activity yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-card">
            <div className="text-xs font-semibold mb-2">Daily packing trend (14d)</div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Line type="monotone" dataKey="packed" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Return KPIs */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <RotateCcw className="h-4 w-4" /> Return team
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Returns processed" value={completed.length} />
          <StatCard label="Avg resolution" value={avgResolutionHrs ? `${avgResolutionHrs}h` : "—"} />
          <StatCard label="Restock rate" value={`${restockRate}%`} />
          <StatCard label="Courier claim rate" value={`${claimRate}%`} />
        </div>
        <div className="rounded-lg border bg-card p-4 shadow-card">
          <div className="text-xs font-semibold mb-2">Top return reasons</div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reasons}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="reason" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={chartTooltip} />
                <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ---------- Performance Analytics ---------- */

function PerformanceAnalytics() {
  const members = useWorkspaceMembers();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [marketplace, setMarketplace] = useState("all");
  const [courier, setCourier] = useState("all");
  const [userId, setUserId] = useState("all");

  const packs = usePackingRecords({
    from: from ? `${from}T00:00:00.000Z` : undefined,
    to: to ? `${to}T23:59:59.999Z` : undefined,
    marketplace,
    courier,
    userId,
  });
  const returns = useReturns();

  const packed = (packs.data ?? []).filter((r) => r.status === "Packed");

  const dailyPacking = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of packed) {
      const k = new Date(r.packing_timestamp || r.created_at).toISOString().slice(0, 10);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort()
      .map(([day, count]) => ({ day: day.slice(5), count }));
  }, [packed]);

  const dailyReturns = useMemo(() => {
    const rows = returns.data ?? [];
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = new Date(r.received_at).toISOString().slice(0, 10);
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return Array.from(m.entries())
      .sort()
      .map(([day, count]) => ({ day: day.slice(5), count }));
  }, [returns.data]);

  const byMarketplace = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of packed) m.set(r.marketplace || "Unknown", (m.get(r.marketplace || "Unknown") ?? 0) + 1);
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [packed]);

  const byCourier = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of packed) m.set(r.courier || "Unknown", (m.get(r.courier || "Unknown") ?? 0) + 1);
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [packed]);

  const byUser = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of packed) m.set(r.user_name || "Unknown", (m.get(r.user_name || "Unknown") ?? 0) + 1);
    return Array.from(m.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [packed]);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Marketplace</Label>
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
            <Label className="text-xs">Courier</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {COURIERS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users</SelectItem>
                {(members.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Packing trend">
          <LineChart data={dailyPacking}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltip} />
            <Line type="monotone" dataKey="count" stroke="var(--primary)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Return trend">
          <LineChart data={dailyReturns}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltip} />
            <Line type="monotone" dataKey="count" stroke="var(--destructive)" strokeWidth={2} dot={false} />
          </LineChart>
        </ChartCard>
        <ChartCard title="Marketplace performance">
          <BarChart data={byMarketplace}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltip} />
            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="Courier performance">
          <BarChart data={byCourier}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltip} />
            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
        <ChartCard title="User productivity">
          <BarChart data={byUser}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={chartTooltip} />
            <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-card">
      <div className="text-xs font-semibold mb-2">{title}</div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ---------- Audit Timeline ---------- */

type TimelineEntry = {
  id: string;
  at: string;
  kind: "audit" | "scan" | "return";
  user: string | null;
  module: string;
  title: string;
  description: string;
};

function AuditTimeline() {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  const [search, setSearch] = useState("");

  const data = useQuery({
    queryKey: ["ops_timeline", wid, search],
    enabled: !!wid,
    queryFn: async () => {
      const term = search.trim();
      // Packing records
      let pq = supabase
        .from("packing_records")
        .select(
          "id, raw_code, order_number, tracking_number, marketplace, courier, status, user_name, created_at, packing_timestamp",
        )
        .eq("workspace_id", wid!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (term) {
        const esc = term.replace(/[%,]/g, "");
        pq = pq.or(
          `order_number.ilike.%${esc}%,tracking_number.ilike.%${esc}%,raw_code.ilike.%${esc}%,user_name.ilike.%${esc}%`,
        );
      }
      // Returns
      let rq = supabase
        .from("returns")
        .select(
          "id, rma, return_number, order_number, tracking_number, marketplace, customer_name, status, resolution, received_at, completed_at, inspector_name, assigned_to_name",
        )
        .eq("workspace_id", wid!)
        .order("received_at", { ascending: false })
        .limit(200);
      if (term) {
        const esc = term.replace(/[%,]/g, "");
        rq = rq.or(
          `order_number.ilike.%${esc}%,tracking_number.ilike.%${esc}%,rma.ilike.%${esc}%,customer_name.ilike.%${esc}%`,
        );
      }
      // Audit logs (search by target_id or action)
      let aq = supabase
        .from("audit_logs")
        .select("*")
        .eq("workspace_id", wid!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (term) {
        const esc = term.replace(/[%,]/g, "");
        aq = aq.or(`target_id.ilike.%${esc}%,action.ilike.%${esc}%`);
      }

      const [p, r, a] = await Promise.all([pq, rq, aq]);
      const profiles = await (async () => {
        const ids = new Set<string>();
        (a.data ?? []).forEach((x: { actor_id: string | null }) => x.actor_id && ids.add(x.actor_id));
        if (!ids.size) return new Map<string, string>();
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", Array.from(ids));
        return new Map((profs ?? []).map((x) => [x.id, x.full_name || x.email]));
      })();

      // Optional SKU search → pull matching order_ids and include their orders via audit/packing
      let skuOrderNumbers = new Set<string>();
      if (term) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id, sku")
          .eq("workspace_id", wid!)
          .ilike("sku", `%${term.replace(/[%,]/g, "")}%`)
          .limit(200);
        const orderIds = Array.from(new Set((items ?? []).map((i) => i.order_id)));
        if (orderIds.length) {
          const { data: ords } = await supabase
            .from("orders")
            .select("order_number")
            .eq("workspace_id", wid!)
            .in("id", orderIds);
          skuOrderNumbers = new Set((ords ?? []).map((o) => o.order_number));
        }
      }

      const entries: TimelineEntry[] = [];

      for (const x of (p.data ?? []) as Array<{
        id: string;
        raw_code: string;
        order_number: string | null;
        tracking_number: string | null;
        marketplace: string | null;
        courier: string | null;
        status: string;
        user_name: string;
        created_at: string;
        packing_timestamp: string | null;
      }>) {
        entries.push({
          id: `p-${x.id}`,
          at: x.packing_timestamp || x.created_at,
          kind: "scan",
          user: x.user_name,
          module: x.status === "Packed" ? "Packing" : "Scanning",
          title: x.status === "Packed" ? "Order packed" : `Scan · ${x.status}`,
          description:
            [x.order_number, x.tracking_number, x.marketplace, x.courier].filter(Boolean).join(" · ") || x.raw_code,
        });
      }

      for (const x of (r.data ?? []) as Array<{
        id: string;
        rma: string;
        return_number: string | null;
        order_number: string | null;
        tracking_number: string | null;
        marketplace: string | null;
        customer_name: string | null;
        status: string;
        resolution: string | null;
        received_at: string;
        completed_at: string | null;
        inspector_name: string | null;
        assigned_to_name: string | null;
      }>) {
        entries.push({
          id: `r-${x.id}`,
          at: x.completed_at || x.received_at,
          kind: "return",
          user: x.inspector_name || x.assigned_to_name,
          module: "Returns",
          title: x.completed_at ? `Return resolved · ${x.resolution || x.status}` : `Return received · ${x.status}`,
          description: [x.rma, x.order_number, x.tracking_number, x.marketplace, x.customer_name]
            .filter(Boolean)
            .join(" · "),
        });
      }

      for (const x of (a.data ?? []) as AuditLog[]) {
        entries.push({
          id: `a-${x.id}`,
          at: x.created_at,
          kind: "audit",
          user: x.actor_id ? (profiles.get(x.actor_id) ?? null) : null,
          module: moduleOf(x.action),
          title: x.action,
          description: describe(x),
        });
      }

      // If SKU search produced orders, keep entries whose description mentions any of them.
      let result = entries;
      if (term && skuOrderNumbers.size) {
        const kept = new Set<string>();
        for (const e of entries) {
          for (const n of skuOrderNumbers) {
            if (e.description.includes(n)) {
              kept.add(e.id);
              break;
            }
          }
        }
        // Combine SKU-matched entries with text-matched entries (already in result).
        result = entries.filter((e) => kept.has(e.id) || e.description.toLowerCase().includes(term.toLowerCase()));
      }

      return result.sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 300);
    },
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card p-4 shadow-card">
        <Label className="text-xs">Search by order #, tracking, user or SKU</Label>
        <div className="mt-1.5 flex gap-2">
          <Input placeholder="Type and press Enter…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button variant="outline" onClick={() => setSearch("")} disabled={!search}>
            Clear
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <ul className="divide-y">
          {(data.data ?? []).map((e) => (
            <li key={e.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{e.title}</span>
                  <StatusPill tone={statusToTone(e.module.toLowerCase())}>{e.module}</StatusPill>
                  {e.user && <span className="text-xs text-muted-foreground">by {e.user}</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{e.description}</div>
              </div>
              <div className="text-xs text-muted-foreground whitespace-nowrap">{new Date(e.at).toLocaleString()}</div>
            </li>
          ))}
          {!(data.data ?? []).length && (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              {data.isLoading ? "Loading…" : "No timeline entries match your search."}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
