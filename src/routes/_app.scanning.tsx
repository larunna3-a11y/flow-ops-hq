import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { ScanLine, QrCode, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";
import { usePackingRecords } from "@/lib/use-warehouse-data";
import { logActivity } from "@/lib/activity.functions";

const MARKETPLACES = ["Shopee", "TikTok Shop", "Tokopedia", "Lazada", "Blibli"];
const COURIERS = [
  "J&T Express",
  "SPX Express",
  "ID Express",
  "AnterAja",
  "SiCepat",
  "Ninja Xpress",
  "GoTo Logistics",
  "Lazada Express",
];

export const Route = createFileRoute("/_app/scanning")({
  head: () => ({
    meta: [
      { title: "Packing Scan — FlowOps" },
      { name: "description", content: "Scan barcodes & QR codes to create packing records." },
    ],
  }),
  component: ScanningPage,
});

function ScanningPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const log = useServerFn(logActivity);
  const codeRef = useRef<HTMLInputElement>(null);

  const [rawCode, setRawCode] = useState("");
  const [orderNumber, setOrderNumber] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [marketplace, setMarketplace] = useState<string>(MARKETPLACES[0]);
  const [courier, setCourier] = useState<string>(COURIERS[0]);
  const [submitting, setSubmitting] = useState(false);

  const recordsQuery = usePackingRecords();
  const records = recordsQuery.data ?? [];

  const kpis = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();
    const todayRecords = records.filter((r) => r.created_at >= todayIso);
    const total = todayRecords.length;
    const packed = todayRecords.filter((r) => r.status === "Packed" || r.status === "Shipped").length;
    const pending = todayRecords.filter((r) => r.status === "Pending").length;
    const activeUsers = new Set(todayRecords.map((r) => r.user_id)).size;
    const matchRate = total ? ((packed / total) * 100).toFixed(1) + "%" : "—";
    return { total, packed, pending, activeUsers, matchRate };
  }, [records]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = rawCode.trim();
    if (!code) {
      toast.error("Enter a barcode or QR value");
      return;
    }
    const workspace = ws.data?.workspace;
    const userId = ws.data?.userId;
    if (!workspace || !userId) {
      toast.error("Workspace not loaded");
      return;
    }

    setSubmitting(true);
    try {
      // Duplicate check
      let dupQuery = supabase
        .from("packing_records")
        .select("id, raw_code, tracking_number, order_number, created_at")
        .eq("workspace_id", workspace.id);
      if (trackingNumber.trim()) {
        dupQuery = dupQuery.or(`raw_code.eq.${code},tracking_number.eq.${trackingNumber.trim()}`);
      } else {
        dupQuery = dupQuery.eq("raw_code", code);
      }
      const { data: dups } = await dupQuery.limit(1);
      if (dups && dups.length > 0) {
        const d = dups[0];
        toast.warning(`Duplicate — already scanned at ${new Date(d.created_at).toLocaleString()}`, {
          description: `Order ${d.order_number ?? "—"} · ${d.raw_code}`,
        });
        return;
      }

      const me = ws.data?.workspace ? await supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle() : null;
      const userName = me?.data?.full_name || me?.data?.email || "Operator";
      const role = ws.data?.role ?? null;
      const nowIso = new Date().toISOString();

      const { data: inserted, error } = await supabase
        .from("packing_records")
        .insert({
          workspace_id: workspace.id,
          user_id: userId,
          user_name: userName,
          role,
          scan_timestamp: nowIso,
          packing_timestamp: nowIso,
          raw_code: code,
          order_number: orderNumber.trim() || null,
          tracking_number: trackingNumber.trim() || null,
          marketplace,
          courier,
          status: "Packed",
        })
        .select("id, order_number")
        .single();

      if (error) {
        if (error.code === "23505") {
          toast.warning("Duplicate barcode or tracking number");
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success(`Packed ${inserted.order_number ?? code}`);
      await log({
        data: {
          action: "packing.scanned",
          target_type: "packing_record",
          target_id: inserted.id,
          metadata: { order_number: inserted.order_number, marketplace, courier },
        },
      }).catch(() => undefined);

      setRawCode("");
      setOrderNumber("");
      setTrackingNumber("");
      codeRef.current?.focus();
      qc.invalidateQueries({ queryKey: ["packing_records"] });
      qc.invalidateQueries({ queryKey: ["audit_logs"] });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("scanning.title")}
        description={t("scanning.description")}
        actions={
          <>
            <Button variant="outline" size="sm">{t("common.exportLog")}</Button>
            <Button size="sm" onClick={() => codeRef.current?.focus()}>{t("scanning.connectScanner")}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("scanning.kpis.scansToday")} value={String(kpis.total)} hint={t("scanning.kpis.scansHint")} icon={<ScanLine className="h-4 w-4" />} />
        <StatCard label={t("scanning.kpis.matchRate")} value={kpis.matchRate} hint={t("scanning.kpis.matchHint")} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard label={t("scanning.kpis.mismatches")} value={String(kpis.pending)} hint={t("scanning.kpis.mismatchHint")} icon={<AlertTriangle className="h-4 w-4" />} />
        <StatCard label={t("scanning.kpis.activeStations")} value={String(kpis.activeUsers)} hint={t("scanning.kpis.stationHint")} icon={<QrCode className="h-4 w-4" />} />
      </div>

      <form onSubmit={handleSubmit} className="rounded-lg border bg-card p-4 shadow-card space-y-3">
        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="raw_code">Barcode / QR</Label>
            <Input
              id="raw_code"
              ref={codeRef}
              value={rawCode}
              onChange={(e) => setRawCode(e.target.value)}
              placeholder="Scan or type code…"
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order_number">Order #</Label>
            <Input id="order_number" value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} placeholder="INV/…/MPL/…" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tracking">Tracking #</Label>
            <Input id="tracking" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="JT…" autoComplete="off" />
          </div>
          <div className="space-y-1.5">
            <Label>Marketplace</Label>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1.5 md:col-span-2">
            <Label>Courier</Label>
            <Select value={courier} onValueChange={setCourier}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {COURIERS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 flex items-end justify-end">
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Record scan
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t("scanning.recent")}</h3>
          <span className="text-xs text-muted-foreground">{recordsQuery.isFetching ? "Loading…" : t("common.updatedJustNow")}</span>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("scanning.columns.time")}</TableHead>
                <TableHead>{t("scanning.columns.code")}</TableHead>
                <TableHead>{t("scanning.columns.order")}</TableHead>
                <TableHead>Marketplace</TableHead>
                <TableHead>Courier</TableHead>
                <TableHead>{t("scanning.columns.scannedBy")}</TableHead>
                <TableHead className="text-right">{t("scanning.columns.result")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.slice(0, 50).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{new Date(s.scan_timestamp).toLocaleString()}</TableCell>
                  <TableCell className="font-mono text-xs">{s.raw_code}</TableCell>
                  <TableCell className="font-mono text-xs">{s.order_number ?? "—"}</TableCell>
                  <TableCell className="text-sm">{s.marketplace ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.courier ?? "—"}</TableCell>
                  <TableCell>{s.user_name}</TableCell>
                  <TableCell className="text-right">
                    <StatusPill tone={statusToTone(s.status.toLowerCase())}>{s.status}</StatusPill>
                  </TableCell>
                </TableRow>
              ))}
              {!records.length && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                    No scans yet. Use the form above to record your first scan.
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
