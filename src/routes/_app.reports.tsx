import { createFileRoute } from "@tanstack/react-router";
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
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
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
import {
  marketplaceBreakdown,
  courierStats,
  userProductivity,
  packingTrend,
} from "@/lib/mock-data";

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
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reporting & analytics"
        description="Marketplace performance, courier KPIs and packer productivity."
        actions={
          <>
            <Button variant="outline" size="sm">Last 30 days</Button>
            <Button size="sm"><Download className="h-4 w-4" /> Export CSV</Button>
          </>
        }
      />

      <Tabs defaultValue="marketplaces" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
          <TabsTrigger value="couriers">Couriers</TabsTrigger>
          <TabsTrigger value="productivity">User productivity</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplaces" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Orders vs. returns by marketplace</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={marketplaceBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="orders" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
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
                  <TableHead className="text-right">Returns</TableHead>
                  <TableHead className="text-right">Return rate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {marketplaceBreakdown.map((m) => (
                  <TableRow key={m.name}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-right">{m.orders.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{m.returns}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {((m.returns / m.orders) * 100).toFixed(1)}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="couriers" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">On-time delivery rate by courier</h3>
            <div className="mt-4 h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courierStats} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" domain={[80, 100]} stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} width={60} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Bar dataKey="onTime" radius={[0, 4, 4, 0]}>
                    {courierStats.map((_, i) => (
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
                  <TableHead className="text-right">On-time %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {courierStats.map((c) => (
                  <TableRow key={c.name}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-right">{c.shipments.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{c.onTime}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="productivity" className="space-y-4">
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h3 className="text-sm font-semibold">Weekly packed volume trend</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={packingTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={chartTooltip} />
                  <Line type="monotone" dataKey="packed" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
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
                  <TableHead className="text-right">Accuracy</TableHead>
                  <TableHead className="text-right">Hours</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userProductivity.map((u) => (
                  <TableRow key={u.name}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                    <TableCell className="text-right">{u.packed}</TableCell>
                    <TableCell className="text-right">{u.accuracy}%</TableCell>
                    <TableCell className="text-right text-muted-foreground">{u.hours}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
