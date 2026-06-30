import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RotateCcw,
  PackageX,
  PackageOpen,
  CheckCircle2,
  Loader2,
  Search,
  ScanLine,
  Upload,
  X,
  ClipboardCheck,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { StatusPill, statusToTone, type Tone } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { useReturns, type ReturnItem, type ReturnRecord, type ReturnTimelineEntry } from "@/lib/use-warehouse-data";
import { logActivity } from "@/lib/activity.functions";
import { notify } from "@/lib/notify";

const MARKETPLACES = ["Shopee", "TikTok Shop", "Tokopedia", "Lazada", "Blibli"];
const REASONS = [
  "Barang rusak",
  "Salah kirim",
  "Tidak sesuai deskripsi",
  "Terlambat",
  "Cacat produk",
  "Customer berubah pikiran",
];
const CONDITIONS = ["Sealed", "Opened", "Used", "Damaged", "Incomplete"];
const STATUSES = [
  "received",
  "inspecting",
  "restock",
  "repackage",
  "exchange",
  "refund",
  "courier_claim",
  "supplier_claim",
  "rejected",
  "completed",
] as const;
type ReturnStatus = (typeof STATUSES)[number];

const STATUS_LABEL: Record<string, string> = {
  received: "Received",
  inspecting: "Under Inspection",
  restock: "Restock",
  repackage: "Repackage",
  exchange: "Exchange",
  refund: "Refund",
  courier_claim: "Courier Claim",
  supplier_claim: "Supplier Claim",
  rejected: "Rejected",
  completed: "Completed",
  restocked: "Restocked",
};

const TIMELINE_STAGES = [
  { key: "order_created", label: "Order Created" },
  { key: "packed", label: "Packed" },
  { key: "shipped", label: "Shipped" },
  { key: "delivered", label: "Delivered" },
  { key: "returned", label: "Returned" },
  { key: "inspection", label: "Inspection" },
  { key: "resolved", label: "Final Resolution" },
];

export const Route = createFileRoute("/_app/returns")({
  head: () => ({
    meta: [
      { title: "Returns — FlowOps" },
      { name: "description", content: "Inspect, restock and resolve incoming returns." },
    ],
  }),
  component: ReturnsPage,
});

function statusTone(status: string): Tone {
  const map: Record<string, Tone> = {
    received: "info",
    inspecting: "warning",
    restock: "success",
    repackage: "warning",
    exchange: "primary",
    refund: "primary",
    courier_claim: "warning",
    supplier_claim: "warning",
    rejected: "danger",
    completed: "success",
  };
  return map[status] ?? statusToTone(status);
}

function ReturnsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const log = useServerFn(logActivity);
  const { data = [] } = useReturns();
  const workspaceId = ws.data?.workspace?.id;

  const [tab, setTab] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [lookup, setLookup] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [form, setForm] = useState({
    return_number: "",
    order_number: "",
    tracking_number: "",
    marketplace: MARKETPLACES[0],
    reason: REASONS[0],
  });
  const [saving, setSaving] = useState(false);

  // Realtime: refresh returns table on changes within this workspace
  useEffect(() => {
    if (!workspaceId) return;
    const ch = supabase
      .channel(`returns-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "returns", filter: `workspace_id=eq.${workspaceId}` },
        () => qc.invalidateQueries({ queryKey: ["returns"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "return_items", filter: `workspace_id=eq.${workspaceId}` },
        () => qc.invalidateQueries({ queryKey: ["return-items"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "return_timeline", filter: `workspace_id=eq.${workspaceId}` },
        () => qc.invalidateQueries({ queryKey: ["return-timeline"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workspaceId, qc]);

  const filtered = useMemo(
    () => (tab === "all" ? data : data.filter((r) => r.status === tab)),
    [data, tab],
  );

  const kpis = useMemo(
    () => ({
      open: data.filter((r) => ["received", "inspecting"].includes(r.status)).length,
      restocked: data.filter((r) => ["restock", "restocked", "completed"].includes(r.status)).length,
      rejected: data.filter((r) => r.status === "rejected").length,
      total: data.length,
    }),
    [data],
  );

  async function lookupAndOpen(rawQuery: string) {
    const q = rawQuery.trim();
    if (!q || !workspaceId) return;
    setLookupLoading(true);
    try {
      // Try existing return first by return_number/rma/tracking/order
      const { data: existing } = await supabase
        .from("returns")
        .select("id")
        .eq("workspace_id", workspaceId)
        .or(
          `return_number.eq.${q},rma.eq.${q},tracking_number.eq.${q},order_number.eq.${q}`,
        )
        .limit(1)
        .maybeSingle();
      if (existing?.id) {
        setActiveId(existing.id);
        return;
      }
      // Otherwise look up source order by tracking/order number
      const { data: order } = await supabase
        .from("orders")
        .select(
          "id, order_number, tracking_number, marketplace, courier, customer_name, ordered_at",
        )
        .eq("workspace_id", workspaceId)
        .or(`tracking_number.eq.${q},order_number.eq.${q}`)
        .limit(1)
        .maybeSingle();
      if (!order) {
        toast.error("No matching return or order found");
        return;
      }
      const newId = await createReturnFromOrder(order.id, q);
      if (newId) setActiveId(newId);
    } finally {
      setLookupLoading(false);
    }
  }

  async function createReturnFromOrder(orderId: string, hintNumber: string) {
    if (!workspaceId) return null;
    const { data: order } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .maybeSingle();
    if (!order) return null;
    const { data: pack } = await supabase
      .from("packing_records")
      .select("id, user_name, packing_timestamp, created_at")
      .eq("workspace_id", workspaceId)
      .or(
        `tracking_number.eq.${order.tracking_number ?? "__none__"},order_number.eq.${order.order_number ?? "__none__"}`,
      )
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const returnNumber = `RMA-${Date.now().toString(36).toUpperCase()}`;
    const { data: inserted, error } = await supabase
      .from("returns")
      .insert({
        workspace_id: workspaceId,
        rma: returnNumber,
        return_number: returnNumber,
        order_id: order.id,
        order_number: order.order_number,
        tracking_number: order.tracking_number,
        marketplace: order.marketplace,
        courier: order.courier,
        customer_name: order.customer_name,
        packing_record_id: pack?.id ?? null,
        packer_name: pack?.user_name ?? null,
        packing_date: pack?.packing_timestamp ?? pack?.created_at ?? null,
        status: "received",
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return null;
    }
    // Seed return_items from order_items
    const { data: items } = await supabase
      .from("order_items")
      .select("id, sku, product_name, product_variant, quantity")
      .eq("order_id", order.id);
    if (items?.length) {
      await supabase.from("return_items").insert(
        items.map((it) => ({
          workspace_id: workspaceId,
          return_id: inserted.id,
          order_item_id: it.id,
          sku: it.sku,
          product_name: it.product_name,
          product_variant: it.product_variant,
          original_quantity: it.quantity,
          returned_quantity: 0,
        })),
      );
    }
    await appendTimeline(inserted.id, "return.created", `Return ${returnNumber} created from lookup "${hintNumber}".`);
    await log({
      data: {
        action: "return.created",
        target_type: "return",
        target_id: inserted.id,
        metadata: { return_number: returnNumber, order_number: order.order_number },
      },
    }).catch(() => undefined);
    notify({
      type: "return.created",
      title: `New return ${returnNumber}`,
      body: `From order ${order.order_number}.`,
      severity: "info",
      link: "/returns",
      roles: ["Return Staff", "Supervisor"],
    });
    qc.invalidateQueries({ queryKey: ["returns"] });
    toast.success(`Return ${returnNumber} created`);
    return inserted.id;
  }

  async function appendTimeline(returnId: string, event: string, message: string, metadata: Record<string, unknown> = {}) {
    if (!workspaceId) return;
    const user = ws.data?.userId;
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("full_name, email").eq("id", user).maybeSingle();
    await supabase.from("return_timeline").insert({
      workspace_id: workspaceId,
      return_id: returnId,
      event,
      message,
      actor_id: user,
      actor_name: prof?.full_name || prof?.email || null,
      metadata: metadata as never,
    });
  }

  async function createManualReturn() {
    if (!workspaceId) return;
    if (!form.return_number.trim()) {
      toast.error("Return number required");
      return;
    }
    setSaving(true);
    const { data: inserted, error } = await supabase
      .from("returns")
      .insert({
        workspace_id: workspaceId,
        rma: form.return_number.trim(),
        return_number: form.return_number.trim(),
        order_number: form.order_number.trim() || null,
        tracking_number: form.tracking_number.trim() || null,
        marketplace: form.marketplace,
        reason: form.reason,
        status: "received",
      })
      .select("id, return_number")
      .single();
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await appendTimeline(inserted.id, "return.created", `Return ${inserted.return_number} created manually.`);
    await log({
      data: { action: "return.created", target_type: "return", target_id: inserted.id, metadata: { return_number: inserted.return_number } },
    }).catch(() => undefined);
    notify({
      type: "return.created",
      title: `New return ${inserted.return_number}`,
      body: `Created manually.`,
      severity: "info",
      link: "/returns",
      roles: ["Return Staff", "Supervisor"],
    });
    setOpen(false);
    setForm({ return_number: "", order_number: "", tracking_number: "", marketplace: MARKETPLACES[0], reason: REASONS[0] });
    qc.invalidateQueries({ queryKey: ["returns"] });
    setActiveId(inserted.id);
  }

  const active = activeId ? data.find((r) => r.id === activeId) ?? null : null;

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
                    <Label>Return number</Label>
                    <Input value={form.return_number} onChange={(e) => setForm({ ...form, return_number: e.target.value })} placeholder="RMA-44126" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Order number</Label>
                      <Input value={form.order_number} onChange={(e) => setForm({ ...form, order_number: e.target.value })} placeholder="INV/…/MPL/…" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tracking number</Label>
                      <Input value={form.tracking_number} onChange={(e) => setForm({ ...form, tracking_number: e.target.value })} placeholder="JNE…" />
                    </div>
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
                  <Button onClick={createManualReturn} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create return
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        }
      />

      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <ScanLine className="h-4 w-4 text-primary" />
            Lookup or scan
          </div>
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              lookupAndOpen(lookup);
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder="Tracking number, order number, or return number"
                className="pl-8"
                autoFocus
              />
            </div>
            <Button type="submit" size="sm" disabled={lookupLoading}>
              {lookupLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Lookup
            </Button>
          </form>
        </div>
      </div>

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
              <TabsTrigger value="restock">Restock</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
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
                <TableRow
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => setActiveId(r.id)}
                >
                  <TableCell className="font-mono text-xs">{r.return_number ?? r.rma}</TableCell>
                  <TableCell className="font-mono text-xs">{r.order_number ?? "—"}</TableCell>
                  <TableCell>{r.marketplace ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.reason ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(r.received_at).toLocaleDateString()}</TableCell>
                  <TableCell className="text-right">
                    <StatusPill tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</StatusPill>
                  </TableCell>
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

      <ReturnInspectionSheet
        record={active}
        onClose={() => setActiveId(null)}
        appendTimeline={appendTimeline}
      />
    </div>
  );
}

function ReturnInspectionSheet({
  record,
  onClose,
  appendTimeline,
}: {
  record: ReturnRecord | null;
  onClose: () => void;
  appendTimeline: (id: string, event: string, message: string, metadata?: Record<string, unknown>) => Promise<void>;
}) {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const log = useServerFn(logActivity);
  const workspaceId = ws.data?.workspace?.id;
  const role = ws.data?.role ?? null;
  const currentUserId = ws.data?.userId ?? null;
  const id = record?.id ?? null;
  const fileInput = useRef<HTMLInputElement>(null);

  /**
   * Edit permissions:
   *  - Owners & Supervisors: edit any return record.
   *  - Return Staff: only the returns they submitted (inspector_id === me,
   *    or the record has not been claimed yet so they can take ownership).
   *  - Other roles: read-only.
   */
  const canEditThisReturn = !!record && (
    role === "Owner" ||
    role === "Supervisor" ||
    (role === "Return Staff" && (!record.inspector_id || record.inspector_id === currentUserId))
  );

  const items = useQuery({
    queryKey: ["return-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_items")
        .select("*")
        .eq("return_id", id!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as ReturnItem[];
    },
  });

  const timeline = useQuery({
    queryKey: ["return-timeline", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("return_timeline")
        .select("*")
        .eq("return_id", id!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ReturnTimelineEntry[];
    },
  });

  const order = useQuery({
    queryKey: ["return-source-order", record?.order_id],
    enabled: !!record?.order_id,
    queryFn: async () => {
      const { data } = await supabase.from("orders").select("*").eq("id", record!.order_id!).maybeSingle();
      return data;
    },
  });

  const [reason, setReason] = useState("");
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<ReturnStatus>("inspecting");
  const [resolution, setResolution] = useState("");
  const [savingForm, setSavingForm] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!record) return;
    setReason(record.reason ?? "");
    setCondition(record.condition ?? "");
    setNotes(record.inspection_notes ?? "");
    setStatus((record.status as ReturnStatus) || "inspecting");
    setResolution(record.resolution ?? "");
  }, [record]);

  useEffect(() => {
    if (!record?.inspection_photos?.length) {
      setPhotoUrls({});
      return;
    }
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const photo of record.inspection_photos) {
        const { data } = await supabase.storage.from("return-photos").createSignedUrl(photo.path, 3600);
        if (data?.signedUrl) map[photo.path] = data.signedUrl;
      }
      if (!cancelled) setPhotoUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [record?.inspection_photos]);

  async function uploadPhotos(files: FileList) {
    if (!record || !workspaceId) return;
    const existing = (record.inspection_photos ?? []) as { path: string }[];
    const added: { path: string }[] = [];
    for (const file of Array.from(files)) {
      const path = `${workspaceId}/${record.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("return-photos").upload(path, file, { upsert: false });
      if (error) {
        toast.error(error.message);
        continue;
      }
      added.push({ path });
    }
    if (!added.length) return;
    const next = [...existing, ...added];
    const { error } = await supabase
      .from("returns")
      .update({ inspection_photos: next as never })
      .eq("id", record.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await appendTimeline(record.id, "return.photos.uploaded", `Uploaded ${added.length} inspection photo(s).`, { count: added.length });
    qc.invalidateQueries({ queryKey: ["returns"] });
    toast.success(`${added.length} photo(s) uploaded`);
  }

  async function removePhoto(path: string) {
    if (!record) return;
    await supabase.storage.from("return-photos").remove([path]);
    const next = (record.inspection_photos ?? []).filter((p) => p.path !== path);
    await supabase.from("returns").update({ inspection_photos: next as never }).eq("id", record.id);
    await appendTimeline(record.id, "return.photo.removed", `Removed inspection photo.`, { path });
    qc.invalidateQueries({ queryKey: ["returns"] });
  }

  async function updateItem(item: ReturnItem, patch: Partial<ReturnItem>) {
    if (!canEditThisReturn) {
      toast.error("You can only edit return records that you submitted.");
      return;
    }
    const { error } = await supabase.from("return_items").update(patch).eq("id", item.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["return-items", record!.id] });
  }

  async function saveInspection() {
    if (!record || !workspaceId) return;
    if (!canEditThisReturn) {
      toast.error("You can only edit return records that you submitted.");
      return;
    }
    setSavingForm(true);
    const user = ws.data?.userId;
    const { data: prof } = user
      ? await supabase.from("profiles").select("full_name, email").eq("id", user).maybeSingle()
      : { data: null as { full_name: string | null; email: string } | null };
    const inspectorName = prof?.full_name || prof?.email || null;
    const previousStatus = record.status;
    const patch: Record<string, unknown> = {
      reason: reason || null,
      condition: condition || null,
      inspection_notes: notes || null,
      status,
      resolution: resolution || null,
      inspection_date: new Date().toISOString(),
      inspector_id: user ?? null,
      inspector_name: inspectorName,
    };
    if (status === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("returns").update(patch as never).eq("id", record.id);
    setSavingForm(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (previousStatus !== status) {
      await appendTimeline(record.id, "return.status_changed", `Status changed: ${STATUS_LABEL[previousStatus] ?? previousStatus} → ${STATUS_LABEL[status] ?? status}.`, {
        from: previousStatus,
        to: status,
      });
    }
    await appendTimeline(record.id, "return.inspection_saved", `Inspection updated by ${inspectorName ?? "user"}.`, {
      condition,
      reason,
    });
    await log({
      data: {
        action: "return.inspection_saved",
        target_type: "return",
        target_id: record.id,
        metadata: { status, condition, reason, resolution },
      },
    }).catch(() => undefined);
    if (status === "restock" || status === "refund" || status === "exchange" || status === "repackage") {
      notify({
        type: "return.completed",
        title: `Return completed`,
        body: `Status: ${status}. Resolution: ${resolution ?? "—"}.`,
        severity: "success",
        link: "/returns",
        roles: ["Owner", "Supervisor"],
        metadata: { return_id: record.id, status, resolution },
      });
    }
    qc.invalidateQueries({ queryKey: ["returns"] });
    toast.success("Inspection saved");
  }

  const discrepancies = (items.data ?? []).filter(
    (i) =>
      i.returned_quantity !== i.original_quantity ||
      i.missing_quantity > 0 ||
      i.damaged_quantity > 0 ||
      i.wrong_quantity > 0,
  );

  return (
    <Sheet open={!!record} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        {record && (
          <>
            <SheetHeader>
              <SheetTitle className="font-mono text-base">{record.return_number ?? record.rma}</SheetTitle>
              <SheetDescription>
                {record.marketplace ?? "—"} · {record.customer_name ?? "Unknown customer"}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-6">
              {/* Original order */}
              <section className="rounded-md border bg-muted/20 p-3 text-sm">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">Original order</h3>
                  <StatusPill tone={statusTone(record.status)}>{STATUS_LABEL[record.status] ?? record.status}</StatusPill>
                </div>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <Field label="Order #" value={record.order_number} mono />
                  <Field label="Tracking" value={record.tracking_number} mono />
                  <Field label="Marketplace" value={record.marketplace} />
                  <Field label="Courier" value={record.courier ?? order.data?.courier ?? null} />
                  <Field label="Customer" value={record.customer_name ?? order.data?.customer_name ?? null} />
                  <Field label="Packed by" value={record.packer_name} />
                  <Field
                    label="Packing date"
                    value={record.packing_date ? new Date(record.packing_date).toLocaleString() : null}
                  />
                  <Field
                    label="Order date"
                    value={order.data?.ordered_at ? new Date(order.data.ordered_at).toLocaleString() : null}
                  />
                </dl>
              </section>

              {/* Item verification */}
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-medium">Item verification</h3>
                  {discrepancies.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-warning-foreground">
                      <AlertTriangle className="h-3 w-3" />
                      {discrepancies.length} discrepancy{discrepancies.length === 1 ? "" : "ies"}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">SKU / Product</TableHead>
                        <TableHead className="text-xs">Orig.</TableHead>
                        <TableHead className="text-xs">Returned</TableHead>
                        <TableHead className="text-xs">Missing</TableHead>
                        <TableHead className="text-xs">Damaged</TableHead>
                        <TableHead className="text-xs">Wrong</TableHead>
                        <TableHead className="text-xs">Inv. Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(items.data ?? []).map((it) => {
                        const mismatch =
                          it.returned_quantity !== it.original_quantity ||
                          it.missing_quantity > 0 ||
                          it.damaged_quantity > 0 ||
                          it.wrong_quantity > 0;
                        return (
                          <TableRow key={it.id} className={mismatch ? "bg-warning/10" : ""}>
                            <TableCell className="text-xs">
                              <div className="font-mono">{it.sku ?? "—"}</div>
                              <div className="text-muted-foreground">
                                {it.product_name ?? "—"}
                                {it.product_variant ? ` · ${it.product_variant}` : ""}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{it.original_quantity}</TableCell>
                            <TableCell><QtyInput value={it.returned_quantity} onCommit={(v) => updateItem(it, { returned_quantity: v })} /></TableCell>
                            <TableCell><QtyInput value={it.missing_quantity} onCommit={(v) => updateItem(it, { missing_quantity: v })} /></TableCell>
                            <TableCell><QtyInput value={it.damaged_quantity} onCommit={(v) => updateItem(it, { damaged_quantity: v })} /></TableCell>
                            <TableCell><QtyInput value={it.wrong_quantity} onCommit={(v) => updateItem(it, { wrong_quantity: v })} /></TableCell>
                            <TableCell>
                              <Select
                                value={it.inventory_action}
                                onValueChange={(v) => updateItem(it, { inventory_action: v as ReturnItem["inventory_action"] })}
                              >
                                <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No action</SelectItem>
                                  <SelectItem value="restock">Restock available</SelectItem>
                                  <SelectItem value="damaged">Damaged stock</SelectItem>
                                  <SelectItem value="quarantine">Quarantine</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {!items.data?.length && (
                        <TableRow><TableCell colSpan={7} className="text-center text-xs text-muted-foreground py-4">No items linked.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Inventory updates are prepared per item. Sync with inventory will be enabled when the inventory module is connected.
                </p>
              </section>

              {/* Inspection form */}
              <section className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-1.5"><ClipboardCheck className="h-4 w-4" /> Inspection</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>Return reason</Label>
                    <Select value={reason} onValueChange={setReason}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Condition</Label>
                    <Select value={condition} onValueChange={setCondition}>
                      <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                      <SelectContent>
                        {CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(v) => setStatus(v as ReturnStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Resolution note</Label>
                    <Input value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="e.g. Refund issued #RF-…" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Inspection notes</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you find on inspection?" />
                </div>
                <div className="space-y-1.5">
                  <Label>Inspection photos</Label>
                  <div className="flex flex-wrap gap-2">
                    {(record.inspection_photos ?? []).map((p) => (
                      <div key={p.path} className="group relative h-20 w-20 overflow-hidden rounded border bg-muted">
                        {photoUrls[p.path] ? (
                          <img src={photoUrls[p.path]} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">…</div>
                        )}
                        <button
                          type="button"
                          onClick={() => removePhoto(p.path)}
                          className="absolute right-0.5 top-0.5 rounded-full bg-background/80 p-0.5 opacity-0 group-hover:opacity-100"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded border border-dashed text-xs text-muted-foreground hover:bg-muted/50"
                    >
                      <Upload className="h-4 w-4" />
                      Upload
                    </button>
                    <input
                      ref={fileInput}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) uploadPhotos(e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={saveInspection} disabled={savingForm}>
                    {savingForm && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save inspection
                  </Button>
                </div>
              </section>

              {/* Lifecycle timeline */}
              <section>
                <h3 className="mb-3 text-sm font-medium flex items-center gap-1.5"><Clock className="h-4 w-4" /> Order lifecycle</h3>
                <LifecycleStages record={record} order={order.data} />
              </section>

              {/* Audit trail timeline */}
              <section>
                <h3 className="mb-2 text-sm font-medium">Audit trail</h3>
                <ol className="space-y-2 border-l pl-4">
                  {(timeline.data ?? []).map((t) => (
                    <li key={t.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="text-xs text-muted-foreground">
                        {new Date(t.created_at).toLocaleString()} · {t.actor_name ?? "system"}
                      </div>
                      <div className="text-sm">{t.message ?? t.event}</div>
                    </li>
                  ))}
                  {!timeline.data?.length && (
                    <li className="text-xs text-muted-foreground">No timeline entries yet.</li>
                  )}
                </ol>
              </section>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono" : ""}>{value ?? "—"}</dd>
    </div>
  );
}

function QtyInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={() => {
        const n = Math.max(0, parseInt(v || "0", 10));
        if (n !== value) onCommit(n);
      }}
      className="h-7 w-16 text-xs"
      inputMode="numeric"
    />
  );
}

function LifecycleStages({ record, order }: { record: ReturnRecord; order: { ordered_at?: string | null; packing_status?: string | null; shipping_status?: string | null } | null | undefined }) {
  const reached: Record<string, string | null> = {
    order_created: order?.ordered_at ?? null,
    packed: record.packing_date,
    shipped: order?.shipping_status === "shipped" || order?.shipping_status === "delivered" ? record.packing_date : null,
    delivered: order?.shipping_status === "delivered" ? record.packing_date : null,
    returned: record.received_at,
    inspection: record.inspection_date,
    resolved: record.completed_at,
  };
  return (
    <ol className="space-y-2">
      {TIMELINE_STAGES.map((s) => {
        const at = reached[s.key];
        const done = !!at;
        return (
          <li key={s.key} className="flex items-center gap-3 text-sm">
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${done ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}`}>
              {done ? "✓" : "·"}
            </span>
            <span className={done ? "" : "text-muted-foreground"}>{s.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{at ? new Date(at).toLocaleString() : "—"}</span>
          </li>
        );
      })}
    </ol>
  );
}