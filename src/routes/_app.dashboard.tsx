import { createFileRoute, Link } from "@tanstack/react-router";
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
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  packingOrders,
  packingTrend,
  marketplaceBreakdown,
  recentActivity,
} from "@/lib/mock-data";

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

function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational overview"
        description="Live snapshot of packing, scanning and returns across your workspace."
        actions={
          <>
            <Button variant="outline" size="sm">Last 7 days</Button>
            <Button size="sm">Export report</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Packed today" value="472" delta={12} hint="Target: 400" icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label="Scans logged" value="3,182" delta={4} hint="Across 6 stations" icon={<ScanLine className="h-4 w-4" />} />
        <StatCard label="Returns received" value="38" delta={-6} hint="18 awaiting inspection" icon={<RotateCcw className="h-4 w-4" />} />
        <StatCard label="On-time ship rate" value="94.2%" delta={2} hint="Across 4 couriers" icon={<Truck className="h-4 w-4" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Packing performance</h3>
              <p className="text-xs text-muted-foreground">Daily packed orders vs. target</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-success">
              <TrendingUp className="h-3.5 w-3.5" /> +18% this week
            </span>
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={packingTrend}>
                <defs>
                  <linearGradient id="packed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--popover-foreground)",
                  }}
                />
                <Area type="monotone" dataKey="target" stroke="var(--muted-foreground)" strokeDasharray="4 4" fill="transparent" />
                <Area type="monotone" dataKey="packed" stroke="var(--chart-1)" strokeWidth={2} fill="url(#packed)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-5 shadow-card">
          <h3 className="text-sm font-semibold text-foreground">Marketplace mix</h3>
          <p className="text-xs text-muted-foreground">Orders by channel (30d)</p>
          <div className="mt-2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={marketplaceBreakdown}
                  dataKey="orders"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  stroke="var(--card)"
                >
                  {marketplaceBreakdown.map((_, i) => (
                    <Cell key={i} fill={pieColors[i % pieColors.length]} />
                  ))}
                </Pie>
                <Legend
                  iconType="circle"
                  wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-lg border bg-card shadow-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <div>
              <h3 className="text-sm font-semibold">Live packing queue</h3>
              <p className="text-xs text-muted-foreground">Latest orders flowing through stations</p>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link to="/packing">Open queue <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <div className="divide-y">
            {packingOrders.slice(0, 6).map((o) => (
              <div key={o.id} className="flex items-center gap-4 px-5 py-3 text-sm">
                <div className="font-mono text-xs text-muted-foreground w-20">{o.orderNumber}</div>
                <div className="flex-1 min-w-0">
                  <div className="truncate font-medium">{o.marketplace} · {o.items} items</div>
                  <div className="text-xs text-muted-foreground">{o.packer ? `Packer: ${o.packer}` : "Unassigned"} · {o.createdAt}</div>
                </div>
                <StatusPill tone={statusToTone(o.status)}>{o.status.replace("_", " ")}</StatusPill>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border bg-card shadow-card">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h3 className="text-sm font-semibold">User activity</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/users">Team <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
          <ul className="divide-y">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                <div className="flex-1 text-sm">
                  <span className="font-medium">{a.user}</span>{" "}
                  <span className="text-muted-foreground">{a.action}</span>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">{a.time}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="rounded-lg border bg-gradient-to-br from-accent to-background p-5 shadow-card">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-warning/20 text-warning-foreground">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">3 stations report scan mismatches</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Pack Station 02 has 4 mismatched scans in the last hour. Review the audit trail to investigate.
            </div>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link to="/scanning">Open scan log</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
