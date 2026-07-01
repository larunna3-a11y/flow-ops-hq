import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";
import type { DetectionRule } from "@/lib/detection";
import { detect } from "@/lib/detection";

export const Route = createFileRoute("/_app/detection-rules")({
  head: () => ({
    meta: [
      { title: "Detection rules — FlowOps" },
      { name: "description", content: "Configurable marketplace & courier auto-detection rules." },
    ],
  }),
  component: DetectionRulesPage,
});

type Draft = {
  id?: string;
  type: "marketplace" | "courier";
  name: string;
  pattern: string;
  priority: number;
  enabled: boolean;
  notes: string;
};

const EMPTY: Draft = { type: "marketplace", name: "", pattern: "", priority: 100, enabled: true, notes: "" };

function DetectionRulesPage() {
  const ws = useWorkspace();
  const wid = ws.data?.workspace?.id;
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; draft: Draft }>({ open: false, draft: EMPTY });
  const [testValue, setTestValue] = useState("");
  const [testResult, setTestResult] = useState<string>("");

  const rulesQ = useQuery({
    queryKey: ["detection_rules", wid],
    enabled: !!wid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("detection_rules")
        .select("*")
        .or(`workspace_id.eq.${wid},is_global.eq.true`)
        .order("type")
        .order("priority");
      if (error) throw error;
      return (data ?? []) as DetectionRule[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!wid) throw new Error("Workspace not loaded");
      // Validate pattern
      try { new RegExp(d.pattern); } catch { throw new Error("Invalid regex pattern"); }
      if (d.id) {
        const { error } = await supabase.from("detection_rules").update({
          name: d.name, pattern: d.pattern, priority: d.priority, enabled: d.enabled, notes: d.notes || null, type: d.type,
        }).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("detection_rules").insert({
          workspace_id: wid, is_global: false, type: d.type, name: d.name, pattern: d.pattern,
          priority: d.priority, enabled: d.enabled, notes: d.notes || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Rule saved");
      setDialog({ open: false, draft: EMPTY });
      qc.invalidateQueries({ queryKey: ["detection_rules"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("detection_rules").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["detection_rules"] }),
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("detection_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Rule deleted"); qc.invalidateQueries({ queryKey: ["detection_rules"] }); },
    onError: (e) => toast.error((e as Error).message),
  });

  const rules = rulesQ.data ?? [];
  const marketplaceRules = useMemo(() => rules.filter((r) => r.type === "marketplace"), [rules]);
  const courierRules = useMemo(() => rules.filter((r) => r.type === "courier"), [rules]);

  async function runTest() {
    if (!wid || !testValue.trim()) return;
    try {
      const r = await detect(testValue, { workspaceId: wid, rules });
      setTestResult(
        `Method: ${r.method} (${Math.round(r.confidence * 100)}%) · Marketplace: ${r.marketplace ?? "—"} · Courier: ${r.courier ?? "—"} · Order: ${r.orderNumber ?? "—"} · Tracking: ${r.trackingNumber ?? "—"}`,
      );
    } catch (e) {
      setTestResult(`Error: ${(e as Error).message}`);
    }
  }

  function openCreate(type: "marketplace" | "courier") {
    setDialog({ open: true, draft: { ...EMPTY, type } });
  }
  function openEdit(r: DetectionRule) {
    if (r.is_global) {
      toast.info("Global rules are read-only. Create a workspace rule to override.");
      return;
    }
    setDialog({
      open: true,
      draft: {
        id: r.id, type: r.type, name: r.name, pattern: r.pattern,
        priority: r.priority, enabled: r.enabled, notes: r.notes ?? "",
      },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Detection rules"
        description="Configurable regex patterns used by the auto-detection engine. Add workspace-specific rules without changing code."
      />

      <div className="rounded-lg border bg-card p-4 shadow-card">
        <div className="text-sm font-semibold">Test detection</div>
        <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
          <Input value={testValue} onChange={(e) => setTestValue(e.target.value)} placeholder="Paste a tracking number, order number, or QR payload…" />
          <Button variant="outline" onClick={runTest}><FlaskConical className="h-4 w-4" /> Test</Button>
        </div>
        {testResult && <div className="mt-2 rounded-md bg-muted/40 p-3 text-xs font-mono">{testResult}</div>}
      </div>

      {(["marketplace", "courier"] as const).map((type) => {
        const list = type === "marketplace" ? marketplaceRules : courierRules;
        return (
          <div key={type} className="rounded-lg border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h3 className="text-sm font-semibold capitalize">{type} rules</h3>
              <Button size="sm" onClick={() => openCreate(type)}><Plus className="h-4 w-4" /> Add rule</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead className="w-20">Priority</TableHead>
                  <TableHead className="w-24">Scope</TableHead>
                  <TableHead className="w-20">Enabled</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.pattern}</TableCell>
                    <TableCell>{r.priority}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_global ? "secondary" : "default"}>{r.is_global ? "Global" : "Workspace"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={r.enabled}
                        disabled={r.is_global}
                        onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)} disabled={r.is_global}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon" variant="ghost"
                        onClick={() => { if (confirm(`Delete rule "${r.name}"?`)) remove.mutate(r.id); }}
                        disabled={r.is_global}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {!list.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No rules.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        );
      })}

      <Dialog open={dialog.open} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialog.draft.id ? "Edit rule" : "Add rule"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={dialog.draft.type} onValueChange={(v) => setDialog((d) => ({ ...d, draft: { ...d.draft, type: v as "marketplace" | "courier" } }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="marketplace">Marketplace</SelectItem>
                  <SelectItem value="courier">Courier</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={dialog.draft.name} onChange={(e) => setDialog((d) => ({ ...d, draft: { ...d.draft, name: e.target.value } }))} placeholder="e.g. Shopee" />
            </div>
            <div className="space-y-1.5">
              <Label>Pattern (JavaScript regex, case-insensitive)</Label>
              <Input value={dialog.draft.pattern} onChange={(e) => setDialog((d) => ({ ...d, draft: { ...d.draft, pattern: e.target.value } }))} placeholder="^SPX|^SPE" className="font-mono" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Priority (lower = first)</Label>
                <Input type="number" value={dialog.draft.priority} onChange={(e) => setDialog((d) => ({ ...d, draft: { ...d.draft, priority: Number(e.target.value) } }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Enabled</Label>
                <div className="flex h-9 items-center"><Switch checked={dialog.draft.enabled} onCheckedChange={(v) => setDialog((d) => ({ ...d, draft: { ...d.draft, enabled: v } }))} /></div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={dialog.draft.notes} onChange={(e) => setDialog((d) => ({ ...d, draft: { ...d.draft, notes: e.target.value } }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog({ open: false, draft: EMPTY })}>Cancel</Button>
            <Button onClick={() => save.mutate(dialog.draft)} disabled={save.isPending || !dialog.draft.name || !dialog.draft.pattern}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
