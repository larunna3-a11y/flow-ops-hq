import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScanLine, QrCode, AlertTriangle, CheckCircle2, Loader2, Zap } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
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
import { useAutomationRules, evaluateRules } from "@/lib/use-automation-rules";
import { MARKETPLACES, COURIERS } from "@/lib/use-orders-data";

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
  const [autoDetected, setAutoDetected] = useState<{
    marketplace?: string;
    courier?: string;
    ruleName?: string;
  } | null>(null);

  const recordsQuery = usePackingRecords();
  const records = recordsQuery.data ?? [];
  const { data: rules = [] } = useAutomationRules();

  // ── USB/Bluetooth scanner support ──────────────────────────────────────────
  // Hardware scanners act as keyboards: they emit characters quickly then send
  // Enter. We detect this by measuring the time between keystrokes — if the
  // whole code arrives in < 80 ms per character, it's a scanner, not a human.
  const scanBufferRef = useRef<string>("");
  const lastKeyTimeRef = useRef<number>(0);
  const scanTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only intercept when focus is NOT in another input/textarea/select
      const active = document.activeElement;
      const inFormField =
        active &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT");

      if (inFormField) return;

      const now = Date.now();
      const gap = now - lastKeyTimeRef.current;
      lastKeyTimeRef.current = now;

      if (e.key === "Enter") {
        const scanned = scanBufferRef.current.trim();
        if (scanned.length > 3) {
          // A scanner just fired — populate the code field and submit
          setRawCode(scanned);
          applyRulesAndSubmit(scanned);
        }
        scanBufferRef.current = "";
        return;
      }

      // If gap > 80 ms, human typing — don't intercept (let it fall to input)
      if (gap > 80 && scanBufferRef.current.length === 0) return;

      // Accumulate scanner characters
      if (e.key.length === 1) {
        scanBufferRef.current += e.key;
      }

      // Safety timeout: clear buffer if scanner stalls mid-code
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = setTimeout(() => {
        scanBufferRef.current = "";
      }, 500);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [rules]); // re-attach when rules change

  // ── Automation rules evaluation ────────────────────────────────────────────
  function applyRules(code: string, tracking = "", order = "") {
    if (!rules.length) return;
    const match = evaluateRules(rules, {
      raw_code: code,
      tracking_number: tracking,
      order_number: order,
    });
    if (match) {
      if (match.marketplace) setMarketplace(match.marketplace);
      if (match.courier) setCourier(match.courier);
      setAutoDetected({
        marketplace: match.marketplace ?? undefined,
        courier: match.courier ?? undefined,
        ruleName: match.rule.name,
      });
    } else {
      setAutoDetected(null);
    }
  }

  // Called when barcode field changes (manual typing or paste)
  function handleCodeChange(value: string) {
    setRawCode(value);
    applyRules(value, trackingNumber, orderNumber);
  }

  // Called directly from USB scanner intercept
  async function applyRulesAndSubmit(code: string) {
    applyRules(code, trackingNumber, orderNumber);
    // Give React one tick to update state before reading it in submit
    setTimeout(() => {
      document.getElementById("scanning-form")?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    }, 50);
  }

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
        dupQuery = dupQuery.or(
          `raw_code.eq.${code},tracking_number.eq.${trackingNumber.trim()}`
        );
      } else {
        dupQuery = dupQuery.eq("raw_code", code);
      }
      const { data: dups } = await dupQuery.limit(1);
      if (dups && dups.length > 0) {
        const d = dups[0];
        toast.warning(
          `Duplicate — already scanned at ${new Date(d.created_at).toLocaleString()}`,
          { description: `Order ${d.order_number ?? "—"} · ${d.raw_code}` }
        );
        return;
      }

      const me = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", userId)
        .maybeSingle();
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

      const autoMsg = autoDetected?.ruleName
        ? ` (auto: ${autoDetected.ruleName})`
        : "";
      toast.success(`Packed ${inserted.order_number ?? code}${autoMsg}`);

      await log({
        data: {
          action: "packing.scanned",
          target_type: "packing_record",
          target_id: inserted.id,
          metadata: {
            order_number: inserted.order_number,
            marketplace,
            courier,
            auto_rule: autoDetected?.ruleName ?? null,
          },
        },
      }).catch(() => undefined);

      setRawCode("");
      setOrderNumber("");
      setTrackingNumber("");
      setAutoDetected(null);
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
            <Button variant="outline" size="sm">
              {t("common.exportLog")}
            </Button>
            <Button size="sm" onClick={() => codeRef.current?.focus()}>
              {t("scanning.connectScanner")}
            </Button>
          </>
        }
      />

      {/* Automation rules active banner */}
      {rules.filter((r) => r.enabled).length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-primary">
          <Zap className="h-3.5 w-3.5 shrink-0" />
          <span>
            {rules.filter((r) => r.enabled).length} automation rule
            {rules.filter((r) => r.enabled).length !== 1 ? "s" : ""} active —
            marketplace and courier will auto-fill on scan.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label={t("scanning.kpis.scansToday")}
          value={String(kpis.total)}
          hint={t("scanning.kpis.scansHint")}
          icon={<ScanLine className="h-4 w-4" />}
        />
        <StatCard
          label={t("scanning.kpis.matchRate")}
          value={kpis.matchRate}
          hint={t("scanning.kpis.matchHint")}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
        <StatCard
          label={t("scanning.kpis.mismatches")}
          value={String(kpis.pending)}
          hint={t("scanning.kpis.mismatchHint")}
          icon={<AlertTriangle className="h-4 w-4" />}
        />
        <StatCard
          label={t("scanning.kpis.activeStations")}
          value={String(kpis.activeUsers)}
          hint={t("scanning.kpis.stationHint")}
          icon={<QrCode className="h-4 w-4" />}
        />
      </div>

      <form
        id="scanning-form"
        onSubmit={handleSubmit}
        className="rounded-lg border bg-card p-4 shadow-card space-y-3"
      >
        {/* Auto-detect badge */}
        {autoDetected && (
          <div className="flex items-center gap-2 text-xs text-primary">
            <Zap className="h-3.5 w-3.5" />
            <span>
              Rule matched: <strong>{autoDetected.ruleName}</strong>
              {autoDetected.marketplace && ` → ${autoDetected.marketplace}`}
              {autoDetected.courier && ` · ${autoDetected.courier}`}
            </span>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="raw_code">Barcode / QR</Label>
            <Input
              id="raw_code"
              ref={codeRef}
              value={rawCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="Scan or type code…"
              autoFocus
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="order_number">Order #</Label>
            <Input
              id="order_number"
              value={orderNumber}
              onChange={(e) => {
                setOrderNumber(e.target.value);
                applyRules(rawCode, trackingNumber, e.target.value);
              }}
              placeholder="INV/…/MPL/…"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tracking">Tracking #</Label>
            <Input
              id="tracking"
              value={trackingNumber}
              onChange={(e) => {
                setTrackingNumber(e.target.value);
                applyRules(rawCode, e.target.value, orderNumber);
              }}
              placeholder="JT…"
              autoComplete="off"
            />
          </div>
          <div className="space-y-1.5">
            <Label>
              Marketplace
              {autoDetected?.marketplace && (
                <Badge variant="outline" className="ml-1.5 text-[10px] py-0 text-primary border-primary/40">
                  auto
                </Badge>
              )}
            </Label>
            <Select value={marketplace} onValueChange={(v) => {
              setMarketplace(v);
              setAutoDetected((prev) => prev ? { ...prev, marketplace: undefined } : null);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-5">
          <div className="space-y-1.5 md:col-span-2">
            <Label>
              Courier
              {autoDetected?.courier && (
                <Badge variant="outline" className="ml-1.5 text-[10px] py-0 text-primary border-primary/40">
                  auto
                </Badge>
              )}
            </Label>
            <Select value={courier} onValueChange={(v) => {
              setCourier(v);
              setAutoDetected((prev) => prev ? { ...prev, courier: undefined } : null);
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COURIERS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
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
          <span className="text-xs text-muted-foreground">
            {recordsQuery.isFetching ? "Loading…" : t("common.updatedJustNow")}
          </span>
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
                <TableHead className="text-right">
                  {t("scanning.columns.result")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.slice(0, 50).map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {new Date(s.scan_timestamp).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.raw_code}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {s.order_number ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {s.marketplace ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.courier ?? "—"}
                  </TableCell>
                  <TableCell>{s.user_name}</TableCell>
                  <TableCell className="text-right">
                    <StatusPill tone={statusToTone(s.status.toLowerCase())}>
                      {s.status}
                    </StatusPill>
                  </TableCell>
                </TableRow>
              ))}
              {!records.length && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-sm text-muted-foreground py-8"
                  >
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
