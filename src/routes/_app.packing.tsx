import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { usePackingRecords } from "@/lib/use-warehouse-data";

export const Route = createFileRoute("/_app/packing")({
  head: () => ({
    meta: [{ title: "Packing — FlowOps" }, { name: "description", content: "Live packing queue from real scans." }],
  }),
  component: PackingPage,
});

function PackingPage() {
  const { t } = useTranslation();
  const { data = [], isFetching } = usePackingRecords();
  const [tab, setTab] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return data.filter((r) => {
      if (tab !== "all" && r.status.toLowerCase() !== tab) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(r.order_number ?? "").toLowerCase().includes(s) && !(r.raw_code ?? "").toLowerCase().includes(s) && !(r.tracking_number ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [data, tab, search]);

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const todayRecords = data.filter((r) => r.created_at >= todayIso);
    return {
      inQueue: data.filter((r) => r.status === "Pending").length,
      activePackers: new Set(todayRecords.map((r) => r.user_id)).size,
      packedToday: todayRecords.filter((r) => r.status !== "Pending" && r.status !== "Cancelled").length,
      shipped: data.filter((r) => r.status === "Shipped").length,
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("packing.title")}
        description={t("packing.description")}
        actions={
          <>
            <Button variant="outline" size="sm"><Filter className="h-4 w-4" /> {t("common.filters")}</Button>
            <Button size="sm" asChild><a href="/scanning"><Plus className="h-4 w-4" /> {t("packing.newTask")}</a></Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("packing.kpis.inQueue")} value={String(kpis.inQueue)} icon={<PackageCheck className="h-4 w-4" />} />
        <StatCard label={t("packing.kpis.activePackers")} value={String(kpis.activePackers)} />
        <StatCard label="Packed today" value={String(kpis.packedToday)} />
        <StatCard label="Shipped" value={String(kpis.shipped)} />
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">{t("packing.tabs.all")}</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="packed">Packed</TabsTrigger>
              <TabsTrigger value="shipped">Shipped</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
            </TabsList>
          </Tabs>
          <Input placeholder={t("packing.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 sm:w-64" />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("packing.columns.order")}</TableHead>
                <TableHead>Tracking</TableHead>
                <TableHead>{t("packing.columns.marketplace")}</TableHead>
                <TableHead>{t("packing.columns.courier")}</TableHead>
                <TableHead>{t("packing.columns.packer")}</TableHead>
                <TableHead>{t("packing.columns.status")}</TableHead>
                <TableHead className="text-right">{t("packing.columns.created")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 200).map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-mono text-xs">{o.order_number ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{o.tracking_number ?? "—"}</TableCell>
                  <TableCell>{o.marketplace ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{o.courier ?? "—"}</TableCell>
                  <TableCell>{o.user_name}</TableCell>
                  <TableCell><StatusPill tone={statusToTone(o.status.toLowerCase())}>{o.status}</StatusPill></TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    {isFetching ? "Loading…" : "No records match."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
