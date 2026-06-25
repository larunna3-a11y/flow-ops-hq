import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { RotateCcw, PackageX, PackageOpen, CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";
import { useReturns } from "@/lib/use-warehouse-data";
import { logActivity } from "@/lib/activity.functions";

const MARKETPLACES = ["Shopee", "TikTok Shop", "Tokopedia", "Lazada", "Blibli"];
const REASONS = ["Barang rusak", "Salah kirim", "Tidak sesuai deskripsi", "Terlambat", "Cacat produk"];

export const Route = createFileRoute("/_app/returns")({
  head: () => ({
    meta: [{ title: "Returns — FlowOps" }, { name: "description", content: "Inspect, restock and resolve incoming returns." }],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const log = useServerFn(logActivity);
  const { data = [] } = useReturns();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ rma: "", order_number: "", marketplace: MARKETPLACES[0], reason: REASONS[0] });
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => tab === "all" ? data : data.filter((r) => r.status === tab), [data, tab]);

  const kpis = useMemo(() => ({
    open: data.filter((r) => r.status === "received" || r.status === "inspecting").length,
    restocked: data.filter((r) => r.status === "restocked").length,
    rejected: data.filter((r) => r.status === "rejected").length,
    total: data.length,
  }), [data]);

  async function createRma() {
    if (!form.rma.trim()) {
      toast.error("RMA number required");
      return;
    }
    setSaving(true);
    const { data: inserted, error } = await supabase.from("returns").insert({
      workspace_id: ws.data!.workspace!.id,
      rma: form.rma.trim(),
      order_number: form.order_number.trim() || null,
      marketplace: form.marketplace,
      reason: form.reason,
      status: "received",
    }).select("id, rma").single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Return ${inserted.rma} created`);
    await log({ data: { action: "return.created", target_type: "return", target_id: inserted.id, metadata: { rma: inserted.rma } } }).catch(() => undefined);
    setOpen(false);
    setForm({ rma: "", order_number: "", marketplace: MARKETPLACES[0], reason: REASONS[0] });
    qc.invalidateQueries({ queryKey: ["returns"] });
    qc.invalidateQueries({ queryKey: ["audit_logs"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("returns.title")}
        description={t("returns.description")}
        actions={
          <>
            <Button variant="outline" size="sm">{t("common.export")}</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">{t("returns.newRma")}</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>New return</DialogTitle>
                  <DialogDescription>Record an incoming RMA from a marketplace.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>RMA number</Label>
                    <Input value={form.rma} onChange={(e) => setForm({ ...form, rma: e.target.value })} placeholder="RMA-44126" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Order number</Label>
                    <Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} placeholder="INV/…/MPL/…" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Marketplace</Label>
                      <Select value={form.marketplace} onValueChange={(v) => setForm({ ...form, marketplace: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {MARKETPLACES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Reason</Label>
                      <Select value={form.reason} onValueChange={(v) => setForm({ ...form, reason: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {REASONS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createRma} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create return
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("returns.kpis.open")} value={String(kpis.open)} icon={<RotateCcw className="h-4 w-4" />} />
        <StatCard label={t("returns.kpis.restocked")} value={String(kpis.restocked)} icon={<PackageOpen className="h-4 w-4" />} />
        <StatCard label={t("returns.kpis.rejected")} value={String(kpis.rejected)} icon={<PackageX className="h-4 w-4" />} />
        <StatCard label="Total returns" value={String(kpis.total)} icon={<CheckCircle2 className="h-4 w-4" />} />
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
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
                <TableHead>{t("returns.columns.received")}</TableHead>
                <TableHead className="text-right">{t("returns.columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.rma}</TableCell>
                  <TableCell className="font-mono text-xs">{r.order_number ?? "—"}</TableCell>
                  <TableCell>{r.marketplace ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.received_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right"><StatusPill tone={statusToTone(r.status)}>{r.status}</StatusPill></TableCell>
                </TableRow>
              ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No returns yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
