import { createFileRoute } from "@tanstack/react-router";
import { Filter, Plus, PackageCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("packing.title")}
        description={t("packing.description")}
        actions={
          <>
            <Button variant="outline" size="sm"><Filter className="h-4 w-4" /> {t("common.filters")}</Button>
            <Button size="sm"><Plus className="h-4 w-4" /> {t("packing.newTask")}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("packing.kpis.inQueue")} value="142" hint={t("packing.kpis.inQueueHint")} icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label={t("packing.kpis.activePackers")} value="6" delta={20} hint={t("packing.kpis.activePackersHint")} />
        <StatCard label={t("packing.kpis.avgTime")} value="2m 14s" delta={-8} hint={t("packing.kpis.avgTimeHint")} />
        <StatCard label={t("packing.kpis.accuracy")} value="99.2%" delta={1} hint={t("packing.kpis.accuracyHint")} />
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">{t("packing.tabs.all")}</TabsTrigger>
              <TabsTrigger value="queued">{t("packing.tabs.queued")}</TabsTrigger>
              <TabsTrigger value="in_progress">{t("packing.tabs.inProgress")}</TabsTrigger>
              <TabsTrigger value="packed">{t("packing.tabs.packed")}</TabsTrigger>
              <TabsTrigger value="shipped">{t("packing.tabs.shipped")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder={t("packing.searchPlaceholder")} className="h-9 sm:w-64" />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("packing.columns.order")}</TableHead>
                <TableHead>{t("packing.columns.marketplace")}</TableHead>
                <TableHead className="text-center">{t("packing.columns.items")}</TableHead>
                <TableHead>{t("packing.columns.courier")}</TableHead>
                <TableHead>{t("packing.columns.packer")}</TableHead>
                <TableHead>{t("packing.columns.priority")}</TableHead>
                <TableHead>{t("packing.columns.status")}</TableHead>
                <TableHead className="text-right">{t("packing.columns.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packingOrders.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.orderNumber}</TableCell>
                  <TableCell>{o.marketplace}</TableCell>
                  <TableCell className="text-center">{o.items}</TableCell>
                  <TableCell className="text-muted-foreground">{o.courier}</TableCell>
                  <TableCell>{o.packer ?? <span className="text-muted-foreground italic">{t("common.unassigned")}</span>}</TableCell>
                  <TableCell><StatusPill tone={priorityTone(o.priority)}>{t(`packing.priority.${o.priority}`, o.priority)}</StatusPill></TableCell>
                  <TableCell><StatusPill tone={statusToTone(o.status)}>{t(`packing.status.${o.status}`, o.status.replace("_", " "))}</StatusPill></TableCell>
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
