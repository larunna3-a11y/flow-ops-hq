import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Activity, Database, HardDrive, Users as UsersIcon, RefreshCw,
  DownloadCloud, Key, Copy, ShieldCheck, Plus, Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  systemStatus, exportWorkspace, requestDatabaseBackup, listBackups,
} from "@/lib/system.functions";
import {
  listApiTokens, createApiToken, revokeApiToken,
} from "@/lib/api-tokens.functions";
import { useWorkspace } from "@/lib/use-workspace";

export const Route = createFileRoute("/_app/system")({
  head: () => ({ meta: [{ title: "System status — FlowOps" }] }),
  component: SystemPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

function SystemPage() {
  const ws = useWorkspace();
  const isOwner = ws.data?.role === "Owner";

  return (
    <div className="p-6 space-y-6">
      <PageHeader title="System status" description="Database health, backups, API access, and platform readiness." />

      <Tabs defaultValue="status">
        <TabsList>
          <TabsTrigger value="status"><Activity className="mr-2 h-4 w-4" />Status</TabsTrigger>
          <TabsTrigger value="backups"><DownloadCloud className="mr-2 h-4 w-4" />Backups</TabsTrigger>
          <TabsTrigger value="api"><Key className="mr-2 h-4 w-4" />API tokens</TabsTrigger>
          <TabsTrigger value="docs"><ShieldCheck className="mr-2 h-4 w-4" />API docs</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="mt-4"><StatusPanel /></TabsContent>
        <TabsContent value="backups" className="mt-4"><BackupsPanel canManage={isOwner} /></TabsContent>
        <TabsContent value="api" className="mt-4"><TokensPanel canManage={isOwner} /></TabsContent>
        <TabsContent value="docs" className="mt-4"><DocsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

/* -------- Status -------- */
function StatusPanel() {
  const qc = useQueryClient();
  const status = useServerFn(systemStatus);
  const q = useQuery({ queryKey: ["system", "status"], queryFn: () => status({}) });
  const s: any = q.data ?? {};
  const fmt = (v?: string | null) => v ? new Date(v).toLocaleString() : "—";

  const cards = [
    { label: "Database", value: s?.database?.reachable ? "Online" : "Offline", icon: Database, ok: !!s?.database?.reachable },
    { label: "Active users", value: s?.counts?.activeMembers ?? 0, icon: UsersIcon, ok: true },
    { label: "Total orders", value: s?.counts?.orders ?? 0, icon: HardDrive, ok: true },
    { label: "Scans recorded", value: s?.counts?.scans ?? 0, icon: Activity, ok: true },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["system"] })}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm text-muted-foreground">{c.label}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{c.value as any}</div>
              <Badge variant={c.ok ? "secondary" : "destructive"} className="mt-1">{c.ok ? "Healthy" : "Issue"}</Badge>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Activity heartbeat</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm">
          <Row label="Last database backup" value={fmt(s.last_backup_at)} />
          <Row label="Last order import" value={fmt(s.last_import_at)} />
          <Row label="Last marketplace sync" value={fmt(s.last_sync_at)} />
          <Row label="Last audit entry" value={fmt(s.last_audit_at)} />
          <Row label="Total returns" value={String(s?.counts?.returns ?? 0)} />
          <Row label="Workspace members" value={String(s?.counts?.members ?? 0)} />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

/* -------- Backups -------- */
function BackupsPanel({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const list = useServerFn(listBackups);
  const exportFn = useServerFn(exportWorkspace);
  const backup = useServerFn(requestDatabaseBackup);
  const q = useQuery({ queryKey: ["system", "backups"], queryFn: () => list({}) });
  const [busy, setBusy] = useState(false);

  const runExport = async () => {
    setBusy(true);
    try {
      const res: any = await exportFn({});
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `flowops-workspace-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${res.rows} rows (${(res.bytes / 1024).toFixed(1)} KB)`);
      qc.invalidateQueries({ queryKey: ["system"] });
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };

  const runBackup = async () => {
    try { await backup({}); toast.success("Manual backup queued"); qc.invalidateQueries({ queryKey: ["system"] }); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Backups & data export</CardTitle>
          <CardDescription>Manual workspace export runs immediately. Database backups require a connected backup target.</CardDescription>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runBackup}>Request DB backup</Button>
            <Button size="sm" onClick={runExport} disabled={busy}>
              <DownloadCloud className="mr-2 h-4 w-4" /> Export workspace JSON
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead><TableHead>Type</TableHead><TableHead>Status</TableHead>
              <TableHead>Rows</TableHead><TableHead>Size</TableHead><TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.isLoading && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
            {!q.isLoading && (q.data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No backup runs yet.</TableCell></TableRow>
            )}
            {(q.data ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{new Date(r.started_at).toLocaleString()}</TableCell>
                <TableCell><Badge variant="outline">{r.kind}</Badge></TableCell>
                <TableCell>
                  <Badge variant={r.status === "success" ? "secondary" : r.status === "failed" ? "destructive" : "outline"}>
                    {r.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">{r.rows ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.bytes ? `${(r.bytes / 1024).toFixed(1)} KB` : "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.notes ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* -------- API tokens -------- */
function TokensPanel({ canManage }: { canManage: boolean }) {
  const qc = useQueryClient();
  const list = useServerFn(listApiTokens);
  const create = useServerFn(createApiToken);
  const revoke = useServerFn(revokeApiToken);
  const q = useQuery({ queryKey: ["system", "tokens"], queryFn: () => list({}) });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [issued, setIssued] = useState<string | null>(null);

  const submit = async () => {
    if (!name.trim()) return toast.error("Name required");
    try {
      const r: any = await create({ data: { name: name.trim(), scopes: ["read"] } });
      setIssued(r.token);
      setName("");
      qc.invalidateQueries({ queryKey: ["system", "tokens"] });
    } catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>API tokens</CardTitle>
          <CardDescription>Issue tokens for future marketplace, warehouse, ERP, or inventory integrations. Tokens are shown once.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setOpen(true); setIssued(null); setName(""); }}>
            <Plus className="mr-2 h-4 w-4" /> New token
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Prefix</TableHead><TableHead>Created</TableHead>
              <TableHead>Last used</TableHead><TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(q.data ?? []).length === 0 && !q.isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No tokens issued.</TableCell></TableRow>
            )}
            {(q.data ?? []).map((t: any) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell className="font-mono text-xs">{t.prefix}…</TableCell>
                <TableCell className="text-xs">{new Date(t.created_at).toLocaleString()}</TableCell>
                <TableCell className="text-xs">{t.last_used_at ? new Date(t.last_used_at).toLocaleString() : "—"}</TableCell>
                <TableCell>
                  <Badge variant={t.revoked_at ? "destructive" : "secondary"}>
                    {t.revoked_at ? "Revoked" : "Active"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  {canManage && !t.revoked_at && (
                    <Button variant="ghost" size="sm" onClick={async () => {
                      await revoke({ data: { id: t.id } });
                      toast.success("Token revoked");
                      qc.invalidateQueries({ queryKey: ["system", "tokens"] });
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create API token</DialogTitle>
            <DialogDescription>Copy the token now — it will not be shown again.</DialogDescription>
          </DialogHeader>
          {!issued ? (
            <div className="space-y-3">
              <Label>Name</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. ERP integration" />
            </div>
          ) : (
            <div className="space-y-3">
              <Label>Your token</Label>
              <div className="flex gap-2">
                <Input readOnly value={issued} className="font-mono text-xs" />
                <Button variant="outline" size="icon"
                  onClick={() => { navigator.clipboard.writeText(issued); toast.success("Copied"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Store this securely. Only its hash is kept in our database.</p>
            </div>
          )}
          <DialogFooter>
            {!issued ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={submit}>Generate</Button>
              </>
            ) : (
              <Button onClick={() => setOpen(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/* -------- API docs -------- */
function DocsPanel() {
  const endpoints = [
    { group: "Marketplace", path: "/api/v1/marketplace/sync", method: "POST", desc: "Trigger a marketplace order pull." },
    { group: "Marketplace", path: "/api/v1/marketplace/webhook", method: "POST", desc: "Receive order/return events from a marketplace." },
    { group: "Warehouse", path: "/api/v1/orders", method: "GET", desc: "List orders with paging and filters." },
    { group: "Warehouse", path: "/api/v1/orders/:id/scan", method: "POST", desc: "Submit a scan event for an order." },
    { group: "Inventory", path: "/api/v1/inventory/stock", method: "GET", desc: "Return current stock levels per SKU." },
    { group: "ERP", path: "/api/v1/erp/invoices", method: "POST", desc: "Push invoice records to a connected ERP." },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>API surface (preview)</CardTitle>
        <CardDescription>
          Endpoint placeholders ready for marketplace, warehouse, ERP, and inventory integrations.
          Authenticate with a Bearer API token from the API tokens tab.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border bg-muted/30 p-3 mb-4 text-xs font-mono">
          curl -H "Authorization: Bearer flo_…" https://your-workspace.flowops.app/api/v1/orders
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group</TableHead><TableHead>Method</TableHead>
              <TableHead>Path</TableHead><TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {endpoints.map(e => (
              <TableRow key={e.path + e.method}>
                <TableCell><Badge variant="outline">{e.group}</Badge></TableCell>
                <TableCell><Badge variant="secondary">{e.method}</Badge></TableCell>
                <TableCell className="font-mono text-xs">{e.path}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
