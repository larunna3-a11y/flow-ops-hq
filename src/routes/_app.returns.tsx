import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, PackageX, PackageOpen, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("returns.title")}
        description={t("returns.description")}
        actions={
          <>
            <Button variant="outline" size="sm">{t("common.export")}</Button>
            <Button size="sm">{t("returns.newRma")}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("returns.kpis.open")} value="38" delta={-6} hint={t("returns.kpis.openHint")} icon={<RotateCcw className="h-4 w-4" />} />
        <StatCard label={t("returns.kpis.restocked")} value="142" delta={9} icon={<PackageOpen className="h-4 w-4" />} />
        <StatCard label={t("returns.kpis.rejected")} value="11" delta={-2} icon={<PackageX className="h-4 w-4" />} />
        <StatCard label={t("returns.kpis.returnRate")} value="3.6%" delta={-1} hint={t("returns.kpis.rateHint")} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">{t("returns.tabs.all")}</TabsTrigger>
              <TabsTrigger value="received">{t("returns.tabs.received")}</TabsTrigger>
              <TabsTrigger value="inspecting">{t("returns.tabs.inspecting")}</TabsTrigger>
              <TabsTrigger value="restocked">{t("returns.tabs.restocked")}</TabsTrigger>
              <TabsTrigger value="rejected">{t("returns.tabs.rejected")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("returns.columns.rma")}</TableHead>
                <TableHead>{t("returns.columns.order")}</TableHead>
                <TableHead>{t("returns.columns.marketplace")}</TableHead>
                <TableHead>{t("returns.columns.reason")}</TableHead>
                <TableHead>{t("returns.columns.assigned")}</TableHead>
                <TableHead>{t("returns.columns.received")}</TableHead>
                <TableHead className="text-right">{t("returns.columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {returns.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.rma}</TableCell>
                  <TableCell className="font-mono text-xs">{r.order}</TableCell>
                  <TableCell>{r.marketplace}</TableCell>
                  <TableCell className="text-sm">{r.reason}</TableCell>
                  <TableCell>{r.assignedTo ?? <span className="text-muted-foreground italic">{t("common.unassigned")}</span>}</TableCell>
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
