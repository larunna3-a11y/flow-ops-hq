import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { useImports } from "@/lib/use-orders-data";
import { useWorkspace, useCurrentUser } from "@/lib/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { parseDestyFile, type DestyParseResult } from "@/lib/desty-parser";
import { deleteImportBatch } from "@/lib/imports.functions";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, Loader2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/imports")({
  head: () => ({ meta: [{ title: "Import Orders — FlowOps" }] }),
  component: ImportsPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;


function ImportsPage() {
  const { t } = useTranslation();
  const imports = useImports();
  const ws = useWorkspace();
  const user = useCurrentUser();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<(DestyParseResult & { filename: string; parsedAt: string }) | null>(null);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; filename: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const role = ws.data?.role ?? null;
  const canDelete = role === "Owner" || role === "Supervisor";

  async function onFileChosen(file: File) {
    setParsing(true);
    setPreview(null);
    try {
      const result = await parseDestyFile(file);
      setPreview({ ...result, filename: file.name, parsedAt: new Date().toISOString() });
      toast.success(`Detected Desty OMS export — ${result.orders.length} orders, ${result.totalItems} items`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't read this file.");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function confirmImport() {
    if (!preview) return;
    const wid = ws.data?.workspace?.id;
    if (!wid) {
      toast.error("No active workspace.");
      return;
    }
    setImporting(true);
    let success = 0;
    let duplicates = 0;
    let failed = 0;

    try {
      // Find duplicates: existing order_numbers in this workspace
      const orderNumbers = preview.orders.map((o) => o.order_number);
      const { data: existing } = await db
        .from("orders")
        .select("order_number")
        .eq("workspace_id", wid)
        .in("order_number", orderNumbers);
      const existingSet = new Set((existing ?? []).map((r: { order_number: string }) => r.order_number));

      const toInsert = preview.orders.filter((o) => {
        if (existingSet.has(o.order_number)) {
          duplicates++;
          return false;
        }
        return true;
      });

      // Insert orders in chunks
      const CHUNK = 200;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const slice = toInsert.slice(i, i + CHUNK);
        const orderRows = slice.map((o) => ({
          workspace_id: wid,
          order_number: o.order_number,
          tracking_number: o.tracking_number,
          store_name: o.store_name,
          marketplace: o.marketplace,
          customer_name: o.customer_name,
          courier: o.courier,
          ordered_at: o.ordered_at,
          order_status: "new",
          packing_status: "pending",
          shipping_status: "pending",
        }));
        const { data: inserted, error } = await db.from("orders").insert(orderRows).select("id, order_number");
        if (error) {
          failed += slice.length;
          continue;
        }
        const idByNumber = new Map<string, string>(
          (inserted ?? []).map((r: { id: string; order_number: string }) => [r.order_number, r.id]),
        );
        const itemRows: Record<string, unknown>[] = [];
        for (const o of slice) {
          const orderId = idByNumber.get(o.order_number);
          if (!orderId) continue;
          for (const it of o.items) {
            itemRows.push({
              workspace_id: wid,
              order_id: orderId,
              sku: it.sku,
              sku_marketplace: it.sku_marketplace,
              sku_master: it.sku,
              product_name: it.product_name,
              product_variant: it.product_variant,
              quantity: it.quantity,
            });
          }
        }
        if (itemRows.length) {
          const { error: itemErr } = await db.from("order_items").insert(itemRows);
          if (itemErr) {
            failed += itemRows.length;
          }
        }
        success += inserted?.length ?? 0;
      }

      // Record import batch
      await db.from("imports").insert({
        workspace_id: wid,
        imported_by: user.data?.id ?? null,
        imported_by_name: user.data?.user_metadata?.full_name ?? user.data?.email ?? null,
        filename: preview.filename,
        total_rows: preview.totalRows,
        success_count: success,
        failed_count: failed,
        duplicate_count: duplicates,
        status: failed > 0 ? "completed_with_errors" : "completed",
      });

      toast.success(`Imported ${success} orders (${duplicates} duplicates skipped)`);
      setPreview(null);
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order_items"] });
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
      qc.invalidateQueries({ queryKey: ["packing"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  /**
   * Delete an imported batch and ALL data it produced:
   *   - orders created during the import window
   *   - their order_items
   *   - related packing_records (matched by order_number / tracking_number)
   *   - related returns (matched by order_id)
   *   - the import history record itself
   *
   * Orders are matched by a tight ±60s window around the import's created_at,
   * which is the period in which confirmImport() inserts its rows. After
   * deletion the same Desty OMS file can be re-imported because the unique
   * (workspace_id, order_number) rows are gone.
   */
  async function deleteImport(id: string) {
    const wid = ws.data?.workspace?.id;
    if (!wid) return;
    setDeleting(true);
    try {
      const { data: imp, error: impFetchErr } = await db
        .from("imports")
        .select("created_at, filename")
        .eq("id", id)
        .maybeSingle();
      if (impFetchErr) {
        toast.error(impFetchErr.message);
        return;
      }

      if (imp) {
        const createdAt = new Date(imp.created_at);
        const from = new Date(createdAt.getTime() - 60_000).toISOString();
        const to = new Date(createdAt.getTime() + 60_000).toISOString();

        const { data: orderRows, error: orderFetchErr } = await db
          .from("orders")
          .select("id, order_number, tracking_number")
          .eq("workspace_id", wid)
          .gte("created_at", from)
          .lte("created_at", to);
        if (orderFetchErr) {
          toast.error(orderFetchErr.message);
          return;
        }

        const orderIds = (orderRows ?? []).map((r: { id: string }) => r.id);
        const orderNumbers = (orderRows ?? [])
          .map((r: { order_number: string | null }) => r.order_number)
          .filter((n: string | null): n is string => !!n);
        const trackingNumbers = (orderRows ?? [])
          .map((r: { tracking_number: string | null }) => r.tracking_number)
          .filter((n: string | null): n is string => !!n);

        if (orderIds.length) {
          // 1) Related returns (and their dependent rows — return_items,
          //    return_timeline — cascade via FK ON DELETE CASCADE).
          //    Chunked: large batches can exceed the request's max URL
          //    length when every order id is inlined into a single
          //    `.in()` filter, which the gateway rejects as a bare
          //    "Bad Request" before it reaches PostgREST.
          const returnsErr = await deleteInChunks("returns", wid, "order_id", orderIds);
          if (returnsErr) {
            toast.error(`Couldn't delete related returns: ${returnsErr.message}`);
            return;
          }

          // 2) Related packing_records — matched by order_number OR tracking_number.
          if (orderNumbers.length) {
            const prByNumberErr = await deleteInChunks("packing_records", wid, "order_number", orderNumbers);
            if (prByNumberErr) {
              toast.error(`Couldn't delete packing records: ${prByNumberErr.message}`);
              return;
            }
          }
          if (trackingNumbers.length) {
            const prByTrackingErr = await deleteInChunks("packing_records", wid, "tracking_number", trackingNumbers);
            if (prByTrackingErr) {
              toast.error(`Couldn't delete packing records: ${prByTrackingErr.message}`);
              return;
            }
          }

          // 3) Order items, then orders (FK order).
          const itemsErr = await deleteInChunks("order_items", wid, "order_id", orderIds);
          if (itemsErr) {
            toast.error(`Couldn't delete order items: ${itemsErr.message}`);
            return;
          }

          const ordersErr = await deleteInChunks("orders", wid, "id", orderIds);
          if (ordersErr) {
            toast.error(`Couldn't delete orders: ${ordersErr.message}`);
            return;
          }
        }
      }

      // 4) Finally delete the import history row.
      const { error } = await db.from("imports").delete().eq("id", id).eq("workspace_id", wid);
      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Imported batch and all related data deleted.");
      qc.invalidateQueries({ queryKey: ["imports"] });
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["order_items"] });
      qc.invalidateQueries({ queryKey: ["packing_records"] });
      qc.invalidateQueries({ queryKey: ["returns"] });
      qc.invalidateQueries({ queryKey: ["dashboard_stats"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import Orders"
        description="Upload your Desty OMS order export. We'll detect the format automatically."
      />

      {/* Uploader */}
      <div className="rounded-lg border bg-card shadow-card p-6">
        <div className="flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-muted/30 py-10 px-4 text-center">
          <FileSpreadsheet className="h-10 w-10 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">Drop your Desty OMS Excel file here</p>
            <p className="text-xs text-muted-foreground mt-1">
              No template, no mapping. Upload the original .xlsx export.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFileChosen(f);
            }}
          />
          <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={parsing || importing}>
            {parsing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Reading file…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Choose file
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="rounded-lg border bg-card shadow-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-medium">Desty OMS format detected</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 font-mono">{preview.filename}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setPreview(null)} disabled={importing}>
                Cancel
              </Button>
              <Button onClick={confirmImport} disabled={importing}>
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing…
                  </>
                ) : (
                  `Import ${preview.orders.length} orders`
                )}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Total Orders" value={preview.orders.length} />
            <Stat label="Total Order Items" value={preview.totalItems} />
            <Stat label="Import Date" value={new Date(preview.parsedAt).toLocaleString()} mono />
          </div>

          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Store</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Courier</TableHead>
                  <TableHead>Tracking</TableHead>
                  <TableHead className="text-right">Items</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.orders.slice(0, 25).map((o) => (
                  <TableRow key={o.order_number}>
                    <TableCell className="font-mono text-xs">{o.order_number}</TableCell>
                    <TableCell>{o.marketplace ?? "—"}</TableCell>
                    <TableCell>{o.store_name ?? "—"}</TableCell>
                    <TableCell>{o.customer_name ?? "—"}</TableCell>
                    <TableCell className="text-xs">{o.courier ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{o.tracking_number ?? "—"}</TableCell>
                    <TableCell className="text-right">{o.items.length}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {preview.orders.length > 25 && (
              <div className="px-4 py-2 text-xs text-muted-foreground border-t bg-muted/30">
                Showing first 25 of {preview.orders.length} orders.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Import history */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">Import history</h2>
        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("imports.columns.time")}</TableHead>
                <TableHead>{t("imports.columns.importedBy")}</TableHead>
                <TableHead>{t("imports.columns.filename")}</TableHead>
                <TableHead className="text-right">{t("imports.columns.total")}</TableHead>
                <TableHead className="text-right">{t("imports.columns.success")}</TableHead>
                <TableHead className="text-right">{t("imports.columns.failed")}</TableHead>
                <TableHead className="text-right">{t("imports.columns.duplicates")}</TableHead>
                <TableHead>{t("imports.columns.status")}</TableHead>
                {canDelete && <TableHead className="text-right w-16">Delete</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(imports.data ?? []).map((i) => (
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
                  {canDelete && (
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        title="Delete this import"
                        onClick={() => setDeleteTarget({ id: i.id, filename: i.filename ?? i.id })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!(imports.data ?? []).length && (
                <TableRow>
                  <TableCell colSpan={canDelete ? 9 : 8} className="text-center text-sm text-muted-foreground py-8">
                    {t("imports.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this imported batch?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>This will remove all imported orders and their related data.</p>
                <p>
                  <strong>This action cannot be undone.</strong>
                </p>
                <p className="text-xs">
                  File: <span className="font-mono text-foreground">{deleteTarget?.filename}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteImport(deleteTarget.id)}
            >
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete batch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="rounded-md border bg-background p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${mono ? "font-mono text-base" : ""}`}>{value}</div>
    </div>
  );
}
