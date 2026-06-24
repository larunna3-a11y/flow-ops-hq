import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, PackageX, PackageOpen, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { returns } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/returns")({
  head: () => ({
    meta: [{ title: "Returns — FlowOps" }, { name: "description", content: "Inspect, restock and resolve incoming returns." }],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Return management"
        description="Track RMAs through inspection, restocking and rejection."
        actions={
          <>
            <Button variant="outline" size="sm">Export</Button>
            <Button size="sm">New RMA</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Open returns" value="38" delta={-6} hint="18 awaiting inspection" icon={<RotateCcw className="h-4 w-4" />} />
        <StatCard label="Restocked (7d)" value="142" delta={9} icon={<PackageOpen className="h-4 w-4" />} />
        <StatCard label="Rejected (7d)" value="11" delta={-2} icon={<PackageX className="h-4 w-4" />} />
        <StatCard label="Return rate" value="3.6%" delta={-1} hint="Of shipped orders" icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="received">Received</TabsTrigger>
              <TabsTrigger value="inspecting">Inspecting</TabsTrigger>
              <TabsTrigger value="restocked">Restocked</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>RMA</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Assigned</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.rma}</TableCell>
                  <TableCell className="font-mono text-xs">{r.order}</TableCell>
                  <TableCell>{r.marketplace}</TableCell>
                  <TableCell className="text-sm">{r.reason}</TableCell>
                  <TableCell>{r.assignedTo ?? <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.receivedAt}</TableCell>
                  <TableCell className="text-right"><StatusPill tone={statusToTone(r.status)}>{r.status}</StatusPill></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
