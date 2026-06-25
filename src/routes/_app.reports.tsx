import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Download, FileText, FileSpreadsheet } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePackingRecords, useWorkspaceMembers } from "@/lib/use-warehouse-data";
import { exportPdf, exportXlsx } from "@/lib/exporters";
import { logActivity } from "@/lib/activity.functions";

const MARKETPLACES = ["Shopee", "TikTok Shop", "Tokopedia", "Lazada", "Blibli"];
const COURIERS = [
  "J&T Express", "SPX Express", "ID Express", "AnterAja", "SiCepat", "Ninja Xpress", "GoTo Logistics", "Lazada Express",
];
const STATUSES = ["Pending", "Packed", "Shipped", "Cancelled"];

export const Route = createFileRoute("/_app/reports")({
  head: () => ({
    meta: [{ title: "Reports — FlowOps" }, { name: "description", content: "Marketplace, courier and user productivity reports." }],
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
  const log = useServerFn(logActivity);
  const today = new Date();
  const last30 = new Date(today); last30.setDate(today.getDate() - 30);
  const [from, setFrom] = useState(last30.toISOString().slice(0, 10));
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [marketplace, setMarketplace] = useState("all");
  const [courier, setCourier] = useState("all");
  const [userId, setUserId] = useState("all");
  const [status, setStatus] = useState("all");

  const { data: members = [] } = useWorkspaceMembers();
  const { data: records = [] } = usePackingRecords({
    from: from ? new Date(from).toISOString() : undefined,
    to: to ? new Date(new Date(to).getTime() + 86400000).toISOString() : undefined,
    marketplace,
    courier,
    userId,
    status,
  });

  const marketplaceAgg = useMemo(() => {
    const m = new Map<string, { name: string; orders: number; packed: number }>();
    for (const r of records) {
      const k = r.marketplace ?? "Unknown";
      const e = m.get(k) ?? { name: k, orders: 0, packed: 0 };
      e.orders += 1;
      if (r.status === "Packed" || r.status === "Shipped") e.packed += 1;
      m.set(k, e);
    }
    return Array.from(m.values());
  }, [records]);

  const courierAgg = useMemo(() => {
    const m = new Map<string, { name: string; shipments: number; shipped: number }>();
    for (const r of records) {
      const k = r.courier ?? "Unknown";
      const e = m.get(k) ?? { name: k, shipments: 0, shipped: 0 };
      e.shipments += 1;
      if (r.status === "Shipped") e.shipped += 1;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => b.shipments - a.shipments);
  }, [records]);

  const productivity = useMemo(() => {
    const m = new Map<string, { name: string; role: string; packed: number }>();
    for (const r of records) {
      if (r.status === "Pending" || r.status === "Cancelled") continue;
      const k = r.user_id;
      const e = m.get(k) ?? { name: r.user_name, role: r.role ?? "—", packed: 0 };
      e.packed += 1;
      m.set(k, e);
    }
    return Array.from(m.values()).sort((a, b) => b.packed - a.packed);
  }, [records]);

  const trendData = useMemo(() => {
    const days: { day: string; packed: number }[] = [];
    const start = new Date(from);
    const end = new Date(to);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push({ day: d.toISOString().slice(5, 10), packed: 0 });
    }
    for (const r of records) {
      if (r.status === "Pending" || r.status === "Cancelled") continue;
      const key = r.created_at.slice(5, 10);
      const d = days.find((x) => x.day === key);
      if (d) d.packed += 1;
    }
    return days;
  }, [records, from, to]);

  function exportRows(kind: "xlsx" | "pdf") {
    const rows = records.map((r) => ({
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
    const stamp = new Date().toISOString().slice(0, 10);
    if (kind === "xlsx") exportXlsx(rows, `flowops-report-${stamp}.xlsx`, "Packing");
    else exportPdf(rows, `flowops-report-${stamp}.pdf`, "FlowOps Packing Report");
    log({ data: { action: "report.exported", target_type: "report", metadata: { format: kind, rows: rows.length } } }).catch(() => undefined);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => exportRows("pdf")}><FileText className="h-4 w-4" /> PDF</Button>
            <Button size="sm" onClick={() => exportRows("xlsx")}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
          </>
        }
      />

      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
          <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Marketplace</Label>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {MARKETPLACES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Courier</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {COURIERS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>User</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUSES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 text-xs text-muted-foreground"><Download className="inline h-3 w-3 mr-1" /> {records.length} records match.</div>
      </div>

      <Tabs defaultValue="marketplaces" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marketplaces">{t("reports.tabs.marketplaces")}</TabsTrigger>
          <TabsTrigger value="couriers">{t("reports.tabs.couriers")}</TabsTrigger>
          <TabsTrigger value="productivity">{t("reports.tabs.productivity")}</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplaces" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Orders by marketplace</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketplaceAgg}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="packed" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
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
                  <TableHead className="text-right">Completion %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketplaceAgg.map((m) => (
                  <TableRow key={m.name}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{m.orders.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{m.packed}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{m.orders ? ((m.packed / m.orders) * 100).toFixed(1) : "0.0"}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="couriers" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Shipments by courier</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courierAgg} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={100} />
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
                  <TableHead className="text-right">Shipments</TableHead>
                  <TableHead className="text-right">Shipped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courierAgg.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.shipments.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{c.shipped}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="productivity" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Daily packing trend</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Line type="monotone" dataKey="packed" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-lg border bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Items packed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productivity.map((u) => (
                  <TableRow key={u.name}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                    <TableCell className="text-right">{u.packed}</TableCell>
                  </TableRow>
                ))}
                {!productivity.length && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-sm text-muted-foreground py-8">No data for current filters.</TableCell>
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
