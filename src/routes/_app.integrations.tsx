import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import * as XLSX from "xlsx";
import {
  Plug,
  RefreshCw,
  Settings as SettingsIcon,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill, statusToTone } from "@/components/status-pill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useStores, useImports, MARKETPLACES, COURIERS, type Store } from "@/lib/use-orders-data";
import { useWorkspace } from "@/lib/use-workspace";
import { logActivity } from "@/lib/activity.functions";
import { notify } from "@/lib/notify";

export const Route = createFileRoute("/_app/integrations")({
  head: () => ({
    meta: [
      { title: "Integrations — FlowOps" },
      {
        name: "description",
        content: "Central place to manage marketplace integrations and import orders into FlowOps.",
      },
    ],
  }),
  component: IntegrationsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

const MARKETPLACE_DESCRIPTIONS: Record<string, string> = {
  Shopee: "Sync orders, tracking and statuses from Shopee Seller Center.",
  "TikTok Shop": "Pull TikTok Shop orders and shipping label data.",
  Tokopedia: "Connect a Tokopedia store to import orders automatically.",
  Lazada: "Bring Lazada orders and fulfilment statuses into FlowOps.",
  Blibli: "Sync Blibli orders and shipment updates.",
};

type ImportRow = {
  order_number: string;
  tracking_number: string;
  marketplace: string;
  courier: string;
  customer_name: string;
  sku: string;
  quantity: number;
  __issues: string[];
  __duplicate?: boolean;
};

// Header aliases for auto-mapping uploaded sheets.
const FIELD_ALIASES: Record<keyof Omit<ImportRow, "__issues" | "__duplicate">, string[]> = {
  order_number: ["order_number", "order number", "order no", "order id", "no pesanan", "nomor pesanan"],
  tracking_number: ["tracking_number", "tracking", "tracking no", "awb", "resi", "no resi"],
  marketplace: ["marketplace", "channel", "platform", "store"],
  courier: ["courier", "shipping", "logistic", "logistik", "kurir", "ekspedisi"],
  customer_name: ["customer", "customer name", "buyer", "buyer name", "nama pembeli", "penerima"],
  sku: ["sku", "kode sku", "kode barang", "product code"],
  quantity: ["quantity", "qty", "jumlah"],
};

function matchField(header: string): keyof typeof FIELD_ALIASES | null {
  const h = header
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, " ");
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => a === h)) return field as keyof typeof FIELD_ALIASES;
  }
  // Loose fallback: contains.
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    if (aliases.some((a) => h.includes(a))) return field as keyof typeof FIELD_ALIASES;
  }
  return null;
}

function IntegrationsPage() {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const isOwner = ws.data?.role === "Owner";
  const wid = ws.data?.workspace?.id;
  const stores = useStores();
  const imports = useImports();
  const log = useServerFn(logActivity);

  const [configureMp, setConfigureMp] = useState<string | null>(null);

  const byMarketplace = useMemo(() => {
    const m = new Map<string, Store[]>();
    for (const s of stores.data ?? []) {
      if (!m.has(s.marketplace)) m.set(s.marketplace, []);
      m.get(s.marketplace)!.push(s);
    }
    return m;
  }, [stores.data]);

  const connect = async (mp: string) => {
    if (!wid || !isOwner) return;
    const existing = byMarketplace.get(mp)?.[0];
    if (existing) {
      const { error } = await db
        .from("stores")
        .update({ connection_status: "connected", last_sync_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await db.from("stores").insert({
        workspace_id: wid,
        name: `${mp} Store`,
        marketplace: mp,
        store_status: "active",
        connection_status: "connected",
        last_sync_at: new Date().toISOString(),
      });
      if (error) return toast.error(error.message);
    }
    await log({ data: { action: "integration.connected", target_type: "marketplace", target_id: mp } }).catch(() => {});
    toast.success(`${mp} connected`);
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const disconnect = async (mp: string) => {
    if (!isOwner) return;
    const targets = byMarketplace.get(mp) ?? [];
    for (const s of targets) {
      await db.from("stores").update({ connection_status: "disconnected", last_sync_at: null }).eq("id", s.id);
    }
    await log({ data: { action: "integration.disconnected", target_type: "marketplace", target_id: mp } }).catch(
      () => {},
    );
    toast.success(`${mp} disconnected`);
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const sync = async (mp: string) => {
    const targets = byMarketplace.get(mp) ?? [];
    if (!targets.length) return toast.error("No stores configured for this marketplace yet.");
    for (const s of targets) {
      await db.from("stores").update({ last_sync_at: new Date().toISOString() }).eq("id", s.id);
    }
    await log({ data: { action: "integration.synced", target_type: "marketplace", target_id: mp } }).catch(() => {});
    toast.success(`${mp} sync queued`);
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integration Center"
        description="Manage marketplace connections and import orders. Configure each integration without touching the Order Management module."
      />

      {/* Marketplace integrations */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Marketplace integrations</h2>
          <Link to="/settings" className="text-xs text-muted-foreground hover:underline">
            Back to Settings
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {MARKETPLACES.map((mp) => {
            const items = byMarketplace.get(mp) ?? [];
            const connected = items.some((s) => s.connection_status === "connected");
            const lastSync = items
              .map((s) => s.last_sync_at)
              .filter(Boolean)
              .sort()
              .reverse()[0] as string | undefined;
            return (
              <div key={mp} className="rounded-lg border bg-card p-5 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{mp}</div>
                    <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{MARKETPLACE_DESCRIPTIONS[mp]}</p>
                  </div>
                  <StatusPill tone={statusToTone(connected ? "active" : "pending")}>
                    {connected ? "Connected" : "Not Connected"}
                  </StatusPill>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Account</dt>
                    <dd className="font-medium">
                      {items[0]?.name ?? <span className="text-muted-foreground">—</span>}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Sync status</dt>
                    <dd className="font-medium capitalize">{items[0]?.connection_status ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last sync</dt>
                    <dd className="font-medium">{lastSync ? new Date(lastSync).toLocaleString() : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Last import</dt>
                    <dd className="font-medium">
                      {(imports.data ?? []).find((i) => (i.filename || "").toLowerCase().includes(mp.toLowerCase()))
                        ? new Date(
                            (imports.data ?? []).find((i) =>
                              (i.filename || "").toLowerCase().includes(mp.toLowerCase()),
                            )!.created_at,
                          ).toLocaleString()
                        : "—"}
                    </dd>
                  </div>
                </dl>
                {isOwner && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {connected ? (
                      <Button size="sm" variant="outline" onClick={() => disconnect(mp)}>
                        <Plug className="h-3.5 w-3.5" /> Disconnect
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => connect(mp)}>
                        <Plug className="h-3.5 w-3.5" /> Connect
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => sync(mp)} disabled={!items.length}>
                      <RefreshCw className="h-3.5 w-3.5" /> Manual Sync
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfigureMp(mp)}>
                      <SettingsIcon className="h-3.5 w-3.5" /> Configure
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Order import */}
      <ManualImportSection
        onDone={() => {
          qc.invalidateQueries({ queryKey: ["imports"] });
          qc.invalidateQueries({ queryKey: ["orders"] });
        }}
      />

      {/* Future API placeholder */}
      <section className="rounded-lg border border-dashed bg-card/50 p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-primary" />
          <div>
            <div className="text-sm font-semibold">Automatic API sync — Coming Soon</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              FlowOps is ready for marketplace API connections. Once enabled, orders will sync automatically from
              Shopee, TikTok Shop, Tokopedia, Lazada and Blibli without manual imports. The Order Management module will
              continue working unchanged.
            </p>
            <div className="mt-2 inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
              <CheckCircle2 className="h-3 w-3" /> Ready for API connection
            </div>
          </div>
        </div>
      </section>

      {/* Import history */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Import history</h2>
        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Imported by</TableHead>
                <TableHead>File name</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Success</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Duplicates</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(imports.data ?? []).slice(0, 25).map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="text-xs">{new Date(i.created_at).toLocaleString()}</TableCell>
                  <TableCell>{i.imported_by_name ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{i.filename ?? "—"}</TableCell>
                  <TableCell className="text-right">{i.total_rows}</TableCell>
                  <TableCell className="text-right text-success">{i.success_count}</TableCell>
                  <TableCell className="text-right text-destructive">{i.failed_count}</TableCell>
                  <TableCell className="text-right">{i.duplicate_count}</TableCell>
                  <TableCell>
                    <StatusPill tone={statusToTone(i.status)}>{i.status}</StatusPill>
                  </TableCell>
                </TableRow>
              ))}
              {!(imports.data ?? []).length && (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                    No imports yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* Configure dialog */}
      <Dialog open={!!configureMp} onOpenChange={(o) => !o && setConfigureMp(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {configureMp}</DialogTitle>
            <DialogDescription>
              Account information and sync preferences. API credential fields will be enabled once the marketplace API
              integration is released.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Store name</Label>
              <Input defaultValue={byMarketplace.get(configureMp ?? "")?.[0]?.name ?? ""} />
            </div>
            <div className="space-y-1.5">
              <Label>API key (coming soon)</Label>
              <Input disabled placeholder="Awaiting marketplace API release" />
            </div>
            <div className="space-y-1.5">
              <Label>Sync frequency (coming soon)</Label>
              <Select disabled>
                <SelectTrigger>
                  <SelectValue placeholder="Every 15 minutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15m">Every 15 minutes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigureMp(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ManualImportSection({ onDone }: { onDone: () => void }) {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  const userId = ws.data?.userId;
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const log = useServerFn(logActivity);

  const validMarketplaces = new Set<string>(MARKETPLACES as readonly string[]);
  const validCouriers = new Set<string>(COURIERS as readonly string[]);

  const summary = useMemo(() => {
    const total = rows.length;
    const dupes = rows.filter((r) => r.__duplicate).length;
    const issues = rows.filter((r) => r.__issues.length > 0).length;
    const valid = total - issues - dupes;
    return { total, dupes, issues, valid };
  }, [rows]);

  const reset = () => {
    setFileName(null);
    setRows([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  const parseFile = async (file: File) => {
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!raw.length) {
        toast.error("The file looks empty.");
        setParsing(false);
        return;
      }
      // Build header map.
      const headers = Object.keys(raw[0]);
      const map: Partial<Record<keyof typeof FIELD_ALIASES, string>> = {};
      for (const h of headers) {
        const f = matchField(h);
        if (f && !map[f]) map[f] = h;
      }
      // Pre-fetch existing order numbers for duplicate detection.
      const candidateOrderNumbers = Array.from(
        new Set(raw.map((r) => String((map.order_number ? r[map.order_number] : "") ?? "").trim()).filter(Boolean)),
      );
      let existing = new Set<string>();
      if (wid && candidateOrderNumbers.length) {
        const { data } = await db
          .from("orders")
          .select("order_number")
          .eq("workspace_id", wid)
          .in("order_number", candidateOrderNumbers.slice(0, 1000));
        existing = new Set((data ?? []).map((r: { order_number: string }) => r.order_number));
      }
      const seenInFile = new Set<string>();
      const parsed: ImportRow[] = raw.map((r) => {
        const get = (k: keyof typeof FIELD_ALIASES) => (map[k] ? String(r[map[k] as string] ?? "").trim() : "");
        const qtyRaw = get("quantity");
        const quantity = Number(qtyRaw) || 0;
        const row: ImportRow = {
          order_number: get("order_number"),
          tracking_number: get("tracking_number"),
          marketplace: get("marketplace"),
          courier: get("courier"),
          customer_name: get("customer_name"),
          sku: get("sku"),
          quantity: quantity > 0 ? quantity : 1,
          __issues: [],
        };
        if (!row.order_number) row.__issues.push("Missing order number");
        if (!row.tracking_number) row.__issues.push("Missing tracking");
        if (!row.sku) row.__issues.push("Missing SKU");
        if (row.marketplace && !validMarketplaces.has(row.marketplace)) row.__issues.push("Invalid marketplace");
        if (row.courier && !validCouriers.has(row.courier)) row.__issues.push("Unknown courier");
        if (row.order_number) {
          if (existing.has(row.order_number) || seenInFile.has(row.order_number)) {
            row.__duplicate = true;
          }
          seenInFile.add(row.order_number);
        }
        return row;
      });
      setRows(parsed);
      setFileName(file.name);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setParsing(false);
  };

  const commit = async () => {
    if (!wid || !userId) return;
    setCommitting(true);
    // Group items by order_number (so multi-line SKUs collapse into one order).
    const groups = new Map<string, ImportRow[]>();
    for (const r of rows) {
      if (!r.order_number || r.__duplicate || r.__issues.length) continue;
      if (!groups.has(r.order_number)) groups.set(r.order_number, []);
      groups.get(r.order_number)!.push(r);
    }
    let success = 0;
    let failed = 0;
    for (const [orderNumber, items] of groups) {
      const head = items[0];
      const { data: ord, error: oErr } = await db
        .from("orders")
        .insert({
          workspace_id: wid,
          order_number: orderNumber,
          tracking_number: head.tracking_number || null,
          marketplace: head.marketplace || null,
          courier: head.courier || null,
          customer_name: head.customer_name || null,
          order_status: "new",
          packing_status: "pending",
          shipping_status: "pending",
          ordered_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (oErr || !ord) {
        failed += items.length;
        continue;
      }
      const payload = items.map((it) => ({
        workspace_id: wid,
        order_id: ord.id,
        sku: it.sku,
        product_name: it.sku,
        quantity: it.quantity,
      }));
      const { error: iErr } = await db.from("order_items").insert(payload);
      if (iErr) failed += items.length;
      else success += items.length;
    }
    const dupes = rows.filter((r) => r.__duplicate).length;
    const invalid = rows.filter((r) => !r.__duplicate && r.__issues.length).length;
    const { data: profile } = await db.from("profiles").select("full_name, email").eq("id", userId).maybeSingle();
    const { data: imp } = await db
      .from("imports")
      .insert({
        workspace_id: wid,
        imported_by: userId,
        imported_by_name: profile?.full_name || profile?.email || null,
        filename: fileName,
        total_rows: rows.length,
        success_count: success,
        failed_count: failed + invalid,
        duplicate_count: dupes,
        status: failed + invalid + dupes === 0 ? "success" : "partial",
      })
      .select("id")
      .single();
    await log({
      data: {
        action: "import.completed",
        target_type: "import",
        target_id: imp?.id ?? null,
        metadata: {
          filename: fileName,
          total: rows.length,
          success,
          failed: failed + invalid,
          duplicates: dupes,
        },
      },
    }).catch(() => {});
    const importFailed = success === 0 && rows.length > 0;
    notify({
      type: importFailed ? "import.failed" : "order.imported",
      title: importFailed ? "Order import failed" : `${success} orders imported`,
      body: `${fileName} — ${success} succeeded, ${failed + invalid} failed, ${dupes} duplicates.`,
      severity: importFailed ? "error" : "success",
      link: "/imports",
      roles: ["Owner", "Supervisor"],
      metadata: { filename: fileName, total: rows.length, success, failed: failed + invalid, duplicates: dupes },
    });
    setCommitting(false);
    toast.success(`Imported ${success} of ${rows.length} rows`);
    reset();
    onDone();
  };

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Manual order import</h2>
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Upload CSV or Excel (.xlsx)</div>
            <p className="text-xs text-muted-foreground mt-1 max-w-lg">
              Headers are mapped automatically (order number, tracking, marketplace, courier, customer, SKU, quantity).
              Preview and validation runs before anything is saved.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) parseFile(f);
              }}
            />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
              <Upload className="h-3.5 w-3.5" />
              {parsing ? "Parsing…" : "Select file"}
            </Button>
            {rows.length > 0 && (
              <Button size="sm" variant="ghost" onClick={reset}>
                Clear
              </Button>
            )}
          </div>
        </div>

        {fileName && (
          <div className="mt-4 flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono">{fileName}</span>
            <span className="text-muted-foreground">· {summary.total} rows</span>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <SummaryStat label="Total" value={summary.total} />
              <SummaryStat label="Valid" value={summary.valid} tone="success" />
              <SummaryStat label="Duplicates" value={summary.dupes} tone="warning" />
              <SummaryStat label="Issues" value={summary.issues} tone="destructive" />
            </div>
            <div className="mt-4 max-h-[360px] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 bg-card">
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Tracking</TableHead>
                    <TableHead>Marketplace</TableHead>
                    <TableHead>Courier</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>Validation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 200).map((r, i) => (
                    <TableRow
                      key={i}
                      className={r.__duplicate ? "bg-warning/5" : r.__issues.length ? "bg-destructive/5" : ""}
                    >
                      <TableCell className="font-mono text-xs">{r.order_number || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.tracking_number || "—"}</TableCell>
                      <TableCell className="text-xs">{r.marketplace || "—"}</TableCell>
                      <TableCell className="text-xs">{r.courier || "—"}</TableCell>
                      <TableCell className="text-xs">{r.customer_name || "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{r.sku || "—"}</TableCell>
                      <TableCell className="text-right text-xs">{r.quantity}</TableCell>
                      <TableCell className="text-xs">
                        {r.__duplicate ? (
                          <span className="inline-flex items-center gap-1 text-warning">
                            <AlertTriangle className="h-3 w-3" /> Duplicate order
                          </span>
                        ) : r.__issues.length ? (
                          <span className="inline-flex items-center gap-1 text-destructive">
                            <AlertTriangle className="h-3 w-3" /> {r.__issues.join(", ")}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-success">
                            <CheckCircle2 className="h-3 w-3" /> OK
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length > 200 && (
                <div className="px-3 py-2 text-center text-xs text-muted-foreground">
                  Showing first 200 of {rows.length} rows.
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={reset} disabled={committing}>
                Cancel
              </Button>
              <Button size="sm" onClick={commit} disabled={committing || summary.valid === 0}>
                {committing ? "Importing…" : `Import ${summary.valid} valid rows`}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "warning" | "destructive";
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "destructive"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-md border bg-muted/20 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
