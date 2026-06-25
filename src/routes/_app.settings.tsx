import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  const notificationKeys = ["scanMismatch", "slaBreach", "dailySummary"] as const;

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <section className="rounded-lg border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold">{t("settings.workspace.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("settings.workspace.subtitle")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">{t("settings.workspace.name")}</Label>
            <Input id="ws-name" defaultValue={workspace.name} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">{t("settings.workspace.slug")}</Label>
            <Input id="ws-slug" defaultValue="northwind" />
          </div>
        </div>
        <Separator className="my-5" />
        <div className="flex justify-end">
          <Button size="sm">{t("common.save")}</Button>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold">{t("settings.appearance.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("settings.appearance.subtitle")}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {(["light", "dark"] as const).map((th) => (
            <button
              key={th}
              onClick={() => setTheme(th)}
              className={`rounded-md border p-4 text-left transition ${
                theme === th ? "border-primary ring-2 ring-primary/30" : "hover:border-foreground/20"
              }`}
            >
              <div className="text-sm font-medium">{t(`settings.appearance.${th}`)}</div>
              <div className="mt-2 h-12 rounded border bg-gradient-to-br"
                style={{
                  background: th === "dark"
                    ? "linear-gradient(135deg, oklch(0.16 0.02 250), oklch(0.26 0.025 250))"
                    : "linear-gradient(135deg, oklch(0.99 0.005 240), oklch(0.92 0.01 240))"
                }}
              />
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold">{t("settings.notifications.title")}</h3>
        <p className="text-xs text-muted-foreground">{t("settings.notifications.subtitle")}</p>
        <div className="mt-4 space-y-4">
          {notificationKeys.map((k, i) => (
            <div key={k} className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-medium">{t(`settings.notifications.items.${k}.title`)}</div>
                <div className="text-xs text-muted-foreground">{t(`settings.notifications.items.${k}.desc`)}</div>
              </div>
              <Switch defaultChecked={i !== 2} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <h3 className="text-sm font-semibold text-destructive">{t("settings.danger.title")}</h3>
        <p className="text-xs text-muted-foreground mt-1">{t("settings.danger.subtitle")}</p>
        <Button variant="destructive" size="sm" className="mt-4">{t("settings.danger.delete")}</Button>
      </section>
    </div>
  );
}
