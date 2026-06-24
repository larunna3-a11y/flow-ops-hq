import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/components/theme-provider";
import { workspace } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [{ title: "Settings — FlowOps" }, { name: "description", content: "Workspace, notifications and appearance settings." }],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Workspace settings" description="Configure your workspace, preferences and notifications." />

      <section className="rounded-lg border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold">Workspace</h3>
        <p className="text-xs text-muted-foreground">Only Owners can edit workspace details.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">Workspace name</Label>
            <Input id="ws-name" defaultValue={workspace.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">URL slug</Label>
            <Input id="ws-slug" defaultValue="northwind" />
          </div>
        </div>
        <Separator className="my-5" />
        <div className="flex justify-end">
          <Button size="sm">Save changes</Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold">Appearance</h3>
        <p className="text-xs text-muted-foreground">Switch between light and dark themes.</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-md border p-4 text-left transition ${
                theme === t ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/20"
              }`}
            >
              <div className="text-sm font-medium capitalize">{t} mode</div>
              <div className="mt-2 h-12 rounded border bg-gradient-to-br"
                style={{
                  background: t === "dark"
                    ? "linear-gradient(135deg, oklch(0.16 0.02 250), oklch(0.26 0.025 250))"
                    : "linear-gradient(135deg, oklch(0.99 0.005 240), oklch(0.92 0.01 240))"
                }}
              />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold">Notifications</h3>
        <p className="text-xs text-muted-foreground">Decide what alerts your team receives.</p>
        <div className="mt-4 space-y-4">
          {[
            { id: "n1", title: "Scan mismatch alerts", desc: "Notify supervisors when a station has more than 3 mismatches in an hour." },
            { id: "n2", title: "SLA breach warnings", desc: "Alert when packing times exceed station targets." },
            { id: "n3", title: "Daily summary email", desc: "Receive a digest of yesterday's operations every morning." },
          ].map((n, i) => (
            <div key={n.id} className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{n.title}</div>
                <div className="text-xs text-muted-foreground">{n.desc}</div>
              </div>
              <Switch defaultChecked={i !== 2} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <h3 className="text-sm font-semibold text-destructive">Danger zone</h3>
        <p className="text-xs text-muted-foreground mt-1">Permanently delete this workspace and all associated data.</p>
        <Button variant="destructive" size="sm" className="mt-4">Delete workspace</Button>
      </section>
    </div>
  );
}
