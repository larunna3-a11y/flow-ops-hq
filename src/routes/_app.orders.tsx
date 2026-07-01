import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Upload, UserPlus } from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";
import { MARKETPLACES, PACKING_STATUSES, useOrders, useOrderItems, useStores, type Order } from "@/lib/use-orders-data";
import { useWorkspaceMembers } from "@/lib/use-warehouse-data";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/_app/orders")({
  head: () => ({ meta: [{ title: "Orders — FlowOps" }] }),
  component: OrdersPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const COLUMN_KEYS = [
  "order_number",
  "marketplace",
  "store_name",
  "customer_name",
  "tracking_number",
  "courier",
] as const;

function OrdersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const isManager = ws.data?.role === "Owner" || ws.data?.role === "Supervisor";
  const wid = ws.data?.workspace?.id;
  const stores = useStores();
  const members = useWorkspaceMembers();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [marketplace, setMarketplace] = useState("all");
  const [store, setStore] = useState("all");
  const [status, setStatus] = useState("all");
  const orders = useOrders({ search, marketplace, store, status });

  // Detail + assign dialog
  const [detail, setDetail] = useState<Order | null>(null);
  const [assignTo, setAssignTo] = useState<string>("");
  const detailItems = useOrderItems(detail?.id);

  // Import dialog
  const [importOpen, setImportOpen] = useState(false);
  const [importRows, setImportRows] = useState<Record<string, unknown>[]>([]);
  const [importFileName, setImportFileName] = useState("");
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const sourceColumns = useMemo(() => (importRows[0] ? Object.keys(importRows[0]) : []), [importRows]);

  const assign = async () => {
    if (!detail || !assignTo || !wid) return;
    const member = members.data?.find((m) => m.id === assignTo);
    if (!member) return;
    const nowIso = new Date().toISOString();
    const { error } = await db
      .from("orders")
      .update({
        assigned_to: member.id,
        assigned_to_name: member.name,
        assigned_at: nowIso,
        packing_status: "ready",
      })
      .eq("id", detail.id);
    if (error) return toast.error(error.message);
    await db.from("order_assignments").insert({
      workspace_id: wid,
      order_id: detail.id,
      packer_id: member.id,
      packer_name: member.name,
      assigned_by: ws.data?.userId,
      assigned_by_name: ws.data?.userId ?? null,
      status: "assigned",
    });
    notify({
      type: "packing.assigned",
      title: "New packing assignment",
      body: `Order ${detail.order_number} assigned to you.`,
      severity: "info",
      link: "/packing",
      userIds: [member.id],
      metadata: { order_id: detail.id, order_number: detail.order_number },
    });
    toast.success(t("orders.toast.assigned", { name: member.name }));
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
    qc.invalidateQueries({ queryKey: ["packing_progress"] });
    setDetail(null);
    setAssignTo("");
  };

  const updateStatus = async (order: Order, next: string) => {
    const { error } = await db.from("orders").update({ packing_status: next }).eq("id", order.id);
    if (error) return toast.error(error.message);
    toast.success(t("orders.toast.statusUpdated"));
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
    qc.invalidateQueries({ queryKey: ["packing_progress"] });
    if (detail?.id === order.id) setDetail({ ...order, packing_status: next });
  };

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    if (!rows.length) return toast.error(t("orders.import.empty"));
    setImportRows(rows);
    setImportFileName(file.name);
    // best-effort auto-map
    const cols = Object.keys(rows[0]);
    const mapping: Record<string, string> = {};
    for (const key of COLUMN_KEYS) {
      const match =
        cols.find((c) => c.toLowerCase().replace(/[^a-z]/g, "") === key.replace(/_/g, "")) ??
        cols.find((c) => c.toLowerCase().includes(key.split("_")[0]));
      if (match) mapping[key] = match;
    }
    setImportMapping(mapping);
    setImportOpen(true);
  };

  const runImport = async () => {
    if (!wid || !importRows.length) return;
    if (!importMapping.order_number) return toast.error(t("orders.import.needOrderNumber"));
    setImporting(true);

    // Build candidates
    const candidates = importRows
      .map((row) => {
        const obj: Record<string, unknown> = { workspace_id: wid };
        for (const key of COLUMN_KEYS) {
          const src = importMapping[key];
          if (src) obj[key] = String(row[src] ?? "").trim();
        }
        obj.packing_status = "pending";
        obj.order_status = "new";
        obj.shipping_status = "Pending";
        return obj;
      })
      .filter((r) => r.order_number);

    // Check for duplicates against existing orders in workspace
    const numbers = candidates.map((c) => c.order_number as string);
    const { data: existing } = await db
      .from("orders")
      .select("order_number")
      .eq("workspace_id", wid)
      .in("order_number", numbers);
    const existingSet = new Set((existing ?? []).map((e: { order_number: string }) => e.order_number));

    let success = 0;
    let duplicates = 0;
    let failed = 0;
    const logs: Record<string, unknown>[] = [];

    // Insert import batch first
    const { data: batch, error: batchErr } = await db
      .from("imports")
      .insert({
        workspace_id: wid,
        imported_by: ws.data?.userId,
        imported_by_name: members.data?.find((m) => m.id === ws.data?.userId)?.name ?? "User",
        filename: importFileName,
        total_rows: importRows.length,
        status: "running",
      })
      .select("id")
      .single();
    if (batchErr) {
      setImporting(false);
      return toast.error(batchErr.message);
    }

    const toInsert: Record<string, unknown>[] = [];
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      if (existingSet.has(c.order_number as string)) {
        duplicates += 1;
        logs.push({
          workspace_id: wid,
          import_id: batch.id,
          row_number: i + 1,
          order_number: c.order_number,
          status: "duplicate",
          message: "Order number already exists",
        });
        continue;
      }
      toInsert.push(c);
      logs.push({
        workspace_id: wid,
        import_id: batch.id,
        row_number: i + 1,
        order_number: c.order_number,
        status: "success",
      });
    }

    if (toInsert.length) {
      const { error: insErr } = await db.from("orders").insert(toInsert);
      if (insErr) {
        failed = toInsert.length;
        success = 0;
        for (const l of logs)
          if (l.status === "success") {
            l.status = "failed";
            l.message = insErr.message;
          }
      } else {
        success = toInsert.length;
      }
    }

    if (logs.length) await db.from("import_logs").insert(logs);
    await db
      .from("imports")
      .update({
        success_count: success,
        failed_count: failed,
        duplicate_count: duplicates,
        status: "completed",
      })
      .eq("id", batch.id);

    setImporting(false);
    setImportOpen(false);
    setImportRows([]);
    toast.success(t("orders.import.done", { success, duplicates, failed }));
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["imports"] });
    qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
    qc.invalidateQueries({ queryKey: ["packing_progress"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("orders.title")}
        description={t("orders.description")}
        actions={
          isManager && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = "";
                }}
              />
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> {t("orders.import.button")}
              </Button>
            </>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder={t("orders.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={marketplace} onValueChange={setMarketplace}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.filters.allMarketplaces")}</SelectItem>
            {MARKETPLACES.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={store} onValueChange={setStore}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.filters.allStores")}</SelectItem>
            {(stores.data ?? []).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("orders.filters.allStatuses")}</SelectItem>
            {PACKING_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`orders.status.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("orders.columns.order")}</TableHead>
              <TableHead>{t("orders.columns.marketplace")}</TableHead>
              <TableHead>{t("orders.columns.store")}</TableHead>
              <TableHead>{t("orders.columns.customer")}</TableHead>
              <TableHead>{t("orders.columns.tracking")}</TableHead>
              <TableHead>{t("orders.columns.courier")}</TableHead>
              <TableHead>{t("orders.columns.packing")}</TableHead>
              <TableHead>{t("orders.columns.assigned")}</TableHead>
              <TableHead>{t("orders.columns.created")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(orders.data ?? []).map((o) => (
              <TableRow key={o.id} className="cursor-pointer" onClick={() => setDetail(o)}>
                <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                <TableCell>{o.marketplace ?? "—"}</TableCell>
                <TableCell>{o.store_name ?? "—"}</TableCell>
                <TableCell>{o.customer_name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{o.tracking_number ?? "—"}</TableCell>
                <TableCell>{o.courier ?? "—"}</TableCell>
                <TableCell>
                  <StatusPill tone={statusToTone(o.packing_status)}>
                    {t(`orders.status.${o.packing_status}`)}
                  </StatusPill>
                </TableCell>
                <TableCell className="text-xs">{o.assigned_to_name ?? t("common.unassigned")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {!(orders.data ?? []).length && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-sm text-muted-foreground py-8">
                  {t("orders.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail dialog */}
      <Dialog
        open={!!detail}
        onOpenChange={(o) => {
          if (!o) setDetail(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{detail?.order_number}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">{t("orders.columns.marketplace")}</div>
                  <div>{detail.marketplace ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("orders.columns.store")}</div>
                  <div>{detail.store_name ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("orders.columns.customer")}</div>
                  <div>
                    {detail.customer_name ?? "—"}
                    {detail.customer_phone ? ` · ${detail.customer_phone}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("orders.columns.courier")}</div>
                  <div>{detail.courier ?? "—"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">{t("orders.columns.tracking")}</div>
                  <div className="font-mono">{detail.tracking_number ?? "—"}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("orders.columns.packing")}</div>
                  {isManager || detail.assigned_to === ws.data?.userId ? (
                    <Select value={detail.packing_status} onValueChange={(v) => updateStatus(detail, v)}>
                      <SelectTrigger className="h-8 mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PACKING_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {t(`orders.status.${s}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <StatusPill tone={statusToTone(detail.packing_status)}>
                      {t(`orders.status.${detail.packing_status}`)}
                    </StatusPill>
                  )}
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("orders.columns.assigned")}</div>
                  <div>{detail.assigned_to_name ?? t("common.unassigned")}</div>
                </div>
              </div>

              <div className="border-t pt-3">
                <div className="text-xs font-medium text-muted-foreground mb-2">{t("orders.items.title")}</div>
                {(detailItems.data ?? []).length ? (
                  <div className="rounded-md border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8 text-xs">{t("orders.items.sku")}</TableHead>
                          <TableHead className="h-8 text-xs">{t("orders.items.product")}</TableHead>
                          <TableHead className="h-8 text-xs">{t("orders.items.variant")}</TableHead>
                          <TableHead className="h-8 text-xs text-right">{t("orders.items.qty")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(detailItems.data ?? []).map((it) => (
                          <TableRow key={it.id}>
                            <TableCell className="font-mono text-xs py-1.5">{it.sku}</TableCell>
                            <TableCell className="text-xs py-1.5">{it.product_name}</TableCell>
                            <TableCell className="text-xs py-1.5">{it.product_variant ?? "—"}</TableCell>
                            <TableCell className="text-xs py-1.5 text-right">{it.quantity}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">{t("orders.items.empty")}</div>
                )}
              </div>

              {isManager && (
                <div className="space-y-1.5 border-t pt-3">
                  <Label>{t("orders.assign.label")}</Label>
                  <div className="flex gap-2">
                    <Select value={assignTo} onValueChange={setAssignTo}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("orders.assign.placeholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {(members.data ?? []).map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={assign} disabled={!assignTo}>
                      <UserPlus className="h-4 w-4" /> {t("orders.assign.button")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("orders.import.title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              {t("orders.import.description", { count: importRows.length, name: importFileName })}
            </p>
            <div className="grid grid-cols-2 gap-3">
              {COLUMN_KEYS.map((key) => (
                <div key={key} className="space-y-1.5">
                  <Label>
                    {t(
                      `orders.columns.${key === "order_number" ? "order" : key === "store_name" ? "store" : key === "customer_name" ? "customer" : key === "tracking_number" ? "tracking" : key}`,
                    )}
                  </Label>
                  <Select
                    value={importMapping[key] ?? ""}
                    onValueChange={(v) => setImportMapping({ ...importMapping, [key]: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {sourceColumns.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={runImport} disabled={importing}>
              {importing ? t("common.sending") : t("orders.import.run")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
