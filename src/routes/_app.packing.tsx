import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { packingOrders } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/packing")({
  head: () => ({
    meta: [{ title: "Packing — FlowOps" }, { name: "description", content: "Live packing queue and station performance." }],
  }),
  component: PackingPage,
});

const priorityTone = (p: string) => (p === "high" ? "danger" : p === "low" ? "muted" : "info");

function PackingPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Packing operations"
        description="Live queue, station throughput and packer assignments."
        actions={
          <>
            <Button variant="outline" size="sm"><Filter className="h-4 w-4" /> Filters</Button>
            <Button size="sm"><Plus className="h-4 w-4" /> New pack task</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="In queue" value="142" hint="High priority: 18" icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label="Active packers" value="6" delta={20} hint="Across 4 stations" />
        <StatCard label="Avg. pack time" value="2m 14s" delta={-8} hint="Target: 2m 30s" />
        <StatCard label="Today's accuracy" value="99.2%" delta={1} hint="Scan-verified" />
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="queued">Queued</TabsTrigger>
              <TabsTrigger value="in_progress">In progress</TabsTrigger>
              <TabsTrigger value="packed">Packed</TabsTrigger>
              <TabsTrigger value="shipped">Shipped</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder="Search by order #" className="h-9 sm:w-64" />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>Packer</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packingOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                  <TableCell>{o.marketplace}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell className="text-muted-foreground">{o.courier}</TableCell>
                  <TableCell>{o.packer ?? <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                  <TableCell><StatusPill tone={priorityTone(o.priority)}>{o.priority}</StatusPill></TableCell>
                  <TableCell><StatusPill tone={statusToTone(o.status)}>{o.status.replace("_", " ")}</StatusPill></TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{o.createdAt}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
