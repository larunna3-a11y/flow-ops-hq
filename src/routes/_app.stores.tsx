import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plug, RefreshCw, Plus, Store as StoreIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill, statusToTone } from "@/components/status-pill";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";
import { useStores, MARKETPLACES } from "@/lib/use-orders-data";
import { seedSprint2 } from "@/lib/sprint2-seed.functions";

export const Route = createFileRoute("/_app/stores")({
  head: () => ({ meta: [{ title: "Connected Stores — FlowOps" }] }),
  component: StoresPage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function StoresPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const stores = useStores();
  const isManager = ws.data?.role === "Owner" || ws.data?.role === "Supervisor";
  const wid = ws.data?.workspace?.id;
  const seed = useServerFn(seedSprint2);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [marketplace, setMarketplace] = useState<string>("Shopee");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ws.data?.role === "Owner" && stores.isSuccess && stores.data.length === 0) {
      seed()
        .then(() => qc.invalidateQueries({ queryKey: ["stores"] }))
        .catch(() => undefined);
    }
  }, [ws.data?.role, stores.isSuccess, stores.data?.length, seed, qc]);

  const addStore = async () => {
    if (!wid || !name.trim()) return;
    setSaving(true);
    const { error } = await db.from("stores").insert({
      workspace_id: wid,
      name: name.trim(),
      marketplace,
      store_status: "active",
      connection_status: "disconnected",
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("stores.toast.added"));
    setOpen(false);
    setName("");
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const toggleConnect = async (id: string, current: string) => {
    const next = current === "connected" ? "disconnected" : "connected";
    const { error } = await db
      .from("stores")
      .update({
        connection_status: next,
        last_sync_at: next === "connected" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(next === "connected" ? t("stores.toast.connected") : t("stores.toast.disconnected"));
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const sync = async (id: string) => {
    const { error } = await db
      .from("stores")
      .update({ last_sync_at: new Date().toISOString(), connection_status: "connected" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("stores.toast.synced"));
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("stores.title")}
        description={t("stores.description")}
        actions={
          isManager && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4" /> {t("stores.add")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("stores.dialog.title")}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>{t("stores.dialog.name")}</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>{t("stores.dialog.marketplace")}</Label>
                    <Select value={marketplace} onValueChange={setMarketplace}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MARKETPLACES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={addStore} disabled={saving}>{t("stores.dialog.save")}</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      <div className="rounded-lg border bg-card shadow-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("stores.columns.store")}</TableHead>
              <TableHead>{t("stores.columns.marketplace")}</TableHead>
              <TableHead>{t("stores.columns.storeStatus")}</TableHead>
              <TableHead>{t("stores.columns.connection")}</TableHead>
              <TableHead>{t("stores.columns.lastSync")}</TableHead>
              <TableHead>{t("stores.columns.created")}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(stores.data ?? []).map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                      <StoreIcon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-medium">{s.name}</span>
                  </div>
                </TableCell>
                <TableCell>{s.marketplace}</TableCell>
                <TableCell>
                  <StatusPill tone={statusToTone(s.store_status)}>{s.store_status}</StatusPill>
                </TableCell>
                <TableCell>
                  <StatusPill tone={statusToTone(s.connection_status === "connected" ? "active" : "pending")}>
                    {s.connection_status}
                  </StatusPill>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  {isManager && (
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => sync(s.id)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => toggleConnect(s.id, s.connection_status)}>
                        <Plug className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!(stores.data ?? []).length && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
                  {t("stores.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
