import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/components/theme-provider";
import { useWorkspace } from "@/lib/use-workspace";
import { supabase } from "@/integrations/supabase/client";
import { setLanguage } from "@/i18n";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({
    meta: [
      { title: "Settings — FlowOps" },
      { name: "description", content: "Workspace, notifications and appearance settings." },
    ],
  }),
  component: SettingsPage,
});

const TIMEZONES = [
  "Asia/Jakarta",
  "Asia/Makassar",
  "Asia/Jayapura",
  "Asia/Singapore",
  "Asia/Kuala_Lumpur",
  "UTC",
];
const CURRENCIES = ["IDR", "USD", "SGD", "MYR", "EUR"];
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "id", label: "Bahasa Indonesia" },
];

function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading } = useWorkspace();
  const workspace = data?.workspace ?? null;
  const isOwner = data?.role === "Owner";

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [address, setAddress] = useState("");
  const [timezone, setTimezone] = useState("Asia/Jakarta");
  const [language, setLanguageState] = useState("id");
  const [currency, setCurrency] = useState("IDR");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!workspace) return;
    setName(workspace.name);
    setSlug(workspace.slug);
    setAddress(workspace.address ?? "");
    setTimezone(workspace.timezone);
    setLanguageState(workspace.language);
    setCurrency(workspace.currency);
    setLogoUrl(workspace.logo_url);
  }, [workspace]);

  const notificationKeys = ["scanMismatch", "slaBreach", "dailySummary"] as const;

  const saveWorkspace = async () => {
    if (!workspace || !isOwner) return;
    if (!name.trim()) return toast.error(t("settings.workspace.nameRequired"));
    setSaving(true);
    const { error } = await supabase
      .from("workspaces")
      .update({ name: name.trim(), slug: slug.trim(), address, timezone, language, currency })
      .eq("id", workspace.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    setLanguage(language);
    toast.success(t("settings.workspace.saved"));
    qc.invalidateQueries({ queryKey: ["current-workspace"] });
  };

  const uploadLogo = async (file: File) => {
    if (!workspace || !isOwner) return;
    if (file.size > 2 * 1024 * 1024) return toast.error(t("settings.workspace.logoTooBig"));
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${workspace.id}/logo-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("workspace-logos")
      .upload(path, file, { upsert: true, cacheControl: "3600" });
    if (uploadError) {
      setUploading(false);
      return toast.error(uploadError.message);
    }
    const { data: signed } = await supabase.storage
      .from("workspace-logos")
      .createSignedUrl(path, 60 * 60 * 24 * 365);
    const url = signed?.signedUrl ?? null;
    const { error: updateError } = await supabase
      .from("workspaces")
      .update({ logo_url: url })
      .eq("id", workspace.id);
    setUploading(false);
    if (updateError) return toast.error(updateError.message);
    setLogoUrl(url);
    qc.invalidateQueries({ queryKey: ["current-workspace"] });
    toast.success(t("settings.workspace.logoUploaded"));
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title={t("settings.title")} description={t("settings.description")} />

      <section className="rounded-lg border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold">{t("settings.workspace.title")}</h3>
        <p className="text-xs text-muted-foreground">
          {isOwner ? t("settings.workspace.subtitleOwner") : t("settings.workspace.subtitle")}
        </p>

        <div className="mt-5 flex items-start gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-md border bg-muted text-sm font-semibold text-muted-foreground">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="h-full w-full object-cover" />
            ) : (
              (name || "??").slice(0, 2).toUpperCase()
            )}
          </div>
          <div className="flex-1">
            <Label>{t("settings.workspace.logo")}</Label>
            <p className="text-xs text-muted-foreground">{t("settings.workspace.logoHint")}</p>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogo(file);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-2"
              disabled={!isOwner || uploading}
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-3.5 w-3.5" />
              {uploading ? t("common.sending") : t("settings.workspace.uploadLogo")}
            </Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ws-name">{t("settings.workspace.name")}</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner || isLoading} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ws-slug">{t("settings.workspace.slug")}</Label>
            <Input id="ws-slug" value={slug} onChange={(e) => setSlug(e.target.value)} disabled={!isOwner || isLoading} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="ws-address">{t("settings.workspace.address")}</Label>
            <Textarea
              id="ws-address"
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={!isOwner || isLoading}
              placeholder={t("settings.workspace.addressPlaceholder")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.workspace.timezone")}</Label>
            <Select value={timezone} onValueChange={setTimezone} disabled={!isOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (<SelectItem key={tz} value={tz}>{tz}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.workspace.language")}</Label>
            <Select value={language} onValueChange={setLanguageState} disabled={!isOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (<SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("settings.workspace.currency")}</Label>
            <Select value={currency} onValueChange={setCurrency} disabled={!isOwner}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Separator className="my-5" />
        <div className="flex justify-end">
          <Button size="sm" onClick={saveWorkspace} disabled={!isOwner || saving}>
            {saving ? t("common.sending") : t("common.save")}
          </Button>
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

      {isOwner && (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h3 className="text-sm font-semibold text-destructive">{t("settings.danger.title")}</h3>
          <p className="text-xs text-muted-foreground mt-1">{t("settings.danger.subtitle")}</p>
          <Button variant="destructive" size="sm" className="mt-4">{t("settings.danger.delete")}</Button>
        </section>
      )}
    </div>
  );
}
