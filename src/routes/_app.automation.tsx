import { useMemo, useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, Bell, FileBarChart, Workflow, Mail } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  listRules, upsertRule, toggleRule, deleteRule,
  listSchedules, upsertSchedule, toggleSchedule, deleteSchedule,
} from "@/lib/automation.functions";
import { emailTemplates } from "@/lib/email-templates";
import { useWorkspace } from "@/lib/use-workspace";
import { canAccess } from "@/lib/permissions";

export const Route = createFileRoute("/_app/automation")({
  component: AutomationPage,
  errorComponent: ({ error }) => <div className="p-6 text-sm text-destructive">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-6">Not found</div>,
});

const TRIGGERS = [
  { value: "order.unpacked.timeout", label: "Order not packed within X hours", category: "packing", configFields: ["hours"] as const },
  { value: "scan.duplicate.threshold", label: "Duplicate scans exceed daily threshold", category: "packing", configFields: ["threshold"] as const },
  { value: "return.created", label: "New return created", category: "returns", configFields: [] as const },
  { value: "courier.claims.threshold", label: "Courier claims exceed threshold", category: "returns", configFields: ["threshold"] as const },
  { value: "report.daily", label: "Generate daily report", category: "reports", configFields: [] as const },
  { value: "report.weekly", label: "Generate weekly report", category: "reports", configFields: [] as const },
  { value: "report.monthly", label: "Generate monthly report", category: "reports", configFields: [] as const },
];

const ROLES = ["Owner", "Supervisor", "Packer", "Return Staff"] as const;
const CHANNELS = [
  { value: "in_app", label: "In-app", live: true },
  { value: "email", label: "Email", live: false },
  { value: "whatsapp", label: "WhatsApp", live: false },
  { value: "slack", label: "Slack", live: false },
  { value: "teams", label: "Microsoft Teams", live: false },
  { value: "discord", label: "Discord", live: false },
  { value: "push", label: "Push", live: false },
];

function AutomationPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const role = ws.data?.role ?? null;
  const canManage = role === "Owner" || role === "Supervisor";

  const rulesFn = useServerFn(listRules);
  const schedulesFn = useServerFn(listSchedules);

  const rulesQ = useQuery({ queryKey: ["automation", "rules"], queryFn: () => rulesFn({}) });
  const schedQ = useQuery({ queryKey: ["automation", "schedules"], queryFn: () => schedulesFn({}) });

  if (!canAccess(role, "automation")) {
    // Permission check is also enforced via RLS; this is a UX guard only.
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Automation & Notifications"
        description="Configure workflow rules, scheduled reports, and notification channels."
      />

      <Tabs defaultValue="rules">
        <TabsList>
          <TabsTrigger value="rules"><Workflow className="mr-2 h-4 w-4" />Rules</TabsTrigger>
          <TabsTrigger value="schedules"><FileBarChart className="mr-2 h-4 w-4" />Scheduled reports</TabsTrigger>
          <TabsTrigger value="channels"><Bell className="mr-2 h-4 w-4" />Channels</TabsTrigger>
          <TabsTrigger value="emails"><Mail className="mr-2 h-4 w-4" />Email templates</TabsTrigger>
        </TabsList>

        <TabsContent value="rules" className="mt-4">
          <RulesPanel
            rules={rulesQ.data ?? []}
            loading={rulesQ.isLoading}
            canManage={canManage}
            onChanged={() => qc.invalidateQueries({ queryKey: ["automation", "rules"] })}
          />
        </TabsContent>

        <TabsContent value="schedules" className="mt-4">
          <SchedulesPanel
            schedules={schedQ.data ?? []}
            loading={schedQ.isLoading}
            canManage={canManage}
            onChanged={() => qc.invalidateQueries({ queryKey: ["automation", "schedules"] })}
          />
        </TabsContent>

        <TabsContent value="channels" className="mt-4">
          <ChannelsPanel />
        </TabsContent>

        <TabsContent value="emails" className="mt-4">
          <EmailTemplatesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- Rules ---------------- */

function RulesPanel({
  rules, loading, canManage, onChanged,
}: { rules: any[]; loading: boolean; canManage: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const toggleFn = useServerFn(toggleRule);
  const deleteFn = useServerFn(deleteRule);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Automation rules</CardTitle>
          <CardDescription>Trigger notifications and actions based on warehouse events.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New rule
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Channels</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && rules.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No rules yet. Create one to get started.</TableCell></TableRow>
            )}
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell><Badge variant="outline">{r.category}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">{TRIGGERS.find(t => t.value === r.trigger)?.label ?? r.trigger}</TableCell>
                <TableCell className="text-xs">
                  {(r.channels ?? []).map((c: string) => (
                    <Badge key={c} variant="secondary" className="mr-1">{c}</Badge>
                  ))}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={r.enabled}
                    disabled={!canManage}
                    onCheckedChange={async (v) => {
                      await toggleFn({ data: { id: r.id, enabled: v } });
                      onChanged();
                    }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(r); setOpen(true); }}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await deleteFn({ data: { id: r.id } });
                        toast.success("Rule deleted");
                        onChanged();
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <RuleDialog open={open} onOpenChange={setOpen} rule={editing} onSaved={() => { setOpen(false); onChanged(); }} />
    </Card>
  );
}

function RuleDialog({ open, onOpenChange, rule, onSaved }:
  { open: boolean; onOpenChange: (b: boolean) => void; rule: any | null; onSaved: () => void }) {
  const upsert = useServerFn(upsertRule);
  const [name, setName] = useState(rule?.name ?? "");
  const [trigger, setTrigger] = useState(rule?.trigger ?? TRIGGERS[0].value);
  const [hours, setHours] = useState<string>(String(rule?.config?.hours ?? 4));
  const [threshold, setThreshold] = useState<string>(String(rule?.config?.threshold ?? 5));
  const [notifyRoles, setNotifyRoles] = useState<string[]>(rule?.config?.notify_roles ?? ["Supervisor"]);
  const [channels, setChannels] = useState<string[]>(rule?.channels ?? ["in_app"]);

  // reset when rule changes
  useMemo(() => {
    setName(rule?.name ?? "");
    setTrigger(rule?.trigger ?? TRIGGERS[0].value);
    setHours(String(rule?.config?.hours ?? 4));
    setThreshold(String(rule?.config?.threshold ?? 5));
    setNotifyRoles(rule?.config?.notify_roles ?? ["Supervisor"]);
    setChannels(rule?.channels ?? ["in_app"]);
  }, [rule?.id]);

  const def = TRIGGERS.find(t => t.value === trigger)!;

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const config: Record<string, unknown> = { notify_roles: notifyRoles };
    if (def.configFields.includes("hours" as never)) config.hours = Number(hours);
    if (def.configFields.includes("threshold" as never)) config.threshold = Number(threshold);
    try {
      await upsert({ data: {
        id: rule?.id,
        name: name.trim(),
        category: def.category as any,
        trigger,
        config,
        channels,
        enabled: rule?.enabled ?? true,
      }});
      toast.success(rule ? "Rule updated" : "Rule created");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{rule ? "Edit rule" : "New automation rule"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alert on stale orders" />
          </div>
          <div>
            <Label>Trigger</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {def.configFields.includes("hours" as never) && (
            <div>
              <Label>Hours threshold</Label>
              <Input type="number" min={1} value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          )}
          {def.configFields.includes("threshold" as never) && (
            <div>
              <Label>Daily count threshold</Label>
              <Input type="number" min={1} value={threshold} onChange={(e) => setThreshold(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Notify roles</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {ROLES.map(r => {
                const on = notifyRoles.includes(r);
                return (
                  <Badge key={r} variant={on ? "default" : "outline"} className="cursor-pointer"
                    onClick={() => setNotifyRoles(on ? notifyRoles.filter(x => x !== r) : [...notifyRoles, r])}>
                    {r}
                  </Badge>
                );
              })}
            </div>
          </div>
          <div>
            <Label>Channels</Label>
            <div className="flex flex-wrap gap-2 mt-2">
              {CHANNELS.map(c => {
                const on = channels.includes(c.value);
                return (
                  <Badge key={c.value}
                    variant={on ? "default" : "outline"}
                    className={`cursor-pointer ${!c.live ? "opacity-60" : ""}`}
                    onClick={() => setChannels(on ? channels.filter(x => x !== c.value) : [...channels, c.value])}>
                    {c.label}{!c.live && " (soon)"}
                  </Badge>
                );
              })}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{rule ? "Save changes" : "Create rule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Schedules ---------------- */

function SchedulesPanel({ schedules, loading, canManage, onChanged }:
  { schedules: any[]; loading: boolean; canManage: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const toggleFn = useServerFn(toggleSchedule);
  const deleteFn = useServerFn(deleteSchedule);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Scheduled reports</CardTitle>
          <CardDescription>Generate Daily, Weekly and Monthly reports automatically.</CardDescription>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setEditing(null); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> New schedule
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Report</TableHead>
              <TableHead>Frequency</TableHead>
              <TableHead>Format</TableHead>
              <TableHead>Recipients</TableHead>
              <TableHead>Next run</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Loading…</TableCell></TableRow>}
            {!loading && schedules.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">No scheduled reports yet.</TableCell></TableRow>
            )}
            {schedules.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.name}</TableCell>
                <TableCell><Badge variant="outline">{s.report_type}</Badge></TableCell>
                <TableCell className="capitalize">{s.frequency}</TableCell>
                <TableCell className="uppercase text-xs">{s.format}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{(s.recipients ?? []).length} recipient(s)</TableCell>
                <TableCell className="text-xs">{s.next_run_at ? new Date(s.next_run_at).toLocaleString() : "—"}</TableCell>
                <TableCell>
                  <Switch
                    checked={s.enabled}
                    disabled={!canManage}
                    onCheckedChange={async (v) => { await toggleFn({ data: { id: s.id, enabled: v } }); onChanged(); }}
                  />
                </TableCell>
                <TableCell className="text-right">
                  {canManage && (
                    <>
                      <Button variant="ghost" size="sm" onClick={() => { setEditing(s); setOpen(true); }}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={async () => {
                        await deleteFn({ data: { id: s.id } });
                        toast.success("Schedule deleted");
                        onChanged();
                      }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
      <ScheduleDialog open={open} onOpenChange={setOpen} schedule={editing} onSaved={() => { setOpen(false); onChanged(); }} />
    </Card>
  );
}

function ScheduleDialog({ open, onOpenChange, schedule, onSaved }:
  { open: boolean; onOpenChange: (b: boolean) => void; schedule: any | null; onSaved: () => void }) {
  const upsert = useServerFn(upsertSchedule);
  const [name, setName] = useState(schedule?.name ?? "");
  const [reportType, setReportType] = useState(schedule?.report_type ?? "overview");
  const [frequency, setFrequency] = useState(schedule?.frequency ?? "daily");
  const [format, setFormat] = useState(schedule?.format ?? "xlsx");
  const [recipients, setRecipients] = useState((schedule?.recipients ?? []).join(", "));

  useMemo(() => {
    setName(schedule?.name ?? "");
    setReportType(schedule?.report_type ?? "overview");
    setFrequency(schedule?.frequency ?? "daily");
    setFormat(schedule?.format ?? "xlsx");
    setRecipients((schedule?.recipients ?? []).join(", "));
  }, [schedule?.id]);

  const save = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const emails = recipients.split(",").map((s: string) => s.trim()).filter(Boolean);
    try {
      await upsert({ data: {
        id: schedule?.id,
        name: name.trim(),
        report_type: reportType as any,
        frequency: frequency as any,
        format: format as any,
        recipients: emails,
        enabled: schedule?.enabled ?? true,
      }});
      toast.success(schedule ? "Schedule updated" : "Schedule created");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{schedule ? "Edit schedule" : "New scheduled report"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Report type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="overview">Overview</SelectItem>
                  <SelectItem value="packing">Packing</SelectItem>
                  <SelectItem value="returns">Returns</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Format</Label>
            <Select value={format} onValueChange={setFormat}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Recipients (comma-separated emails)</Label>
            <Input value={recipients} onChange={e => setRecipients(e.target.value)} placeholder="ops@company.com, manager@company.com" />
            <p className="text-xs text-muted-foreground mt-1">Email delivery activates when an email provider is connected.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save}>{schedule ? "Save changes" : "Create schedule"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Channels ---------------- */

function ChannelsPanel() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Delivery channels</CardTitle>
        <CardDescription>In-app notifications are live. Other channels are ready for integration.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {CHANNELS.map(c => (
            <div key={c.value} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{c.label}</div>
                <div className="text-xs text-muted-foreground">{c.live ? "Active" : "Coming soon"}</div>
              </div>
              <Badge variant={c.live ? "default" : "secondary"}>{c.live ? "Live" : "Soon"}</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- Email templates ---------------- */

function EmailTemplatesPanel() {
  const keys = Object.keys(emailTemplates) as (keyof typeof emailTemplates)[];
  const [selected, setSelected] = useState<typeof keys[number]>(keys[0]);
  const t = emailTemplates[selected];
  const sample = t.html({
    workspace: "Acme Warehouse", inviter: "Alex", name: "Sam", role: "Packer",
    link: "https://app.flowops.io/invite/xyz",
    report_type: "Packing", frequency: "Daily", generated_at: new Date().toLocaleString(),
    title: "Maintenance window", body: "Brief read-only window tomorrow 02:00–02:15 UTC.",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email templates</CardTitle>
        <CardDescription>Preview-ready templates. Sending activates when an email provider is connected.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-[220px_1fr] gap-4">
          <div className="space-y-1">
            {keys.map(k => (
              <button key={k}
                className={`w-full text-left text-sm px-3 py-2 rounded-md border ${selected === k ? "bg-muted border-border" : "border-transparent hover:bg-muted/50"}`}
                onClick={() => setSelected(k)}>
                {k}
              </button>
            ))}
          </div>
          <div className="border rounded-lg overflow-hidden">
            <div className="bg-muted px-4 py-2 text-xs text-muted-foreground border-b">
              Subject: {t.subject({
                workspace: "Acme Warehouse", report_type: "Packing", frequency: "Daily", title: "Maintenance window",
              })}
            </div>
            <iframe title="email preview" srcDoc={sample} className="w-full h-[420px] bg-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
