import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plug, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { StatusPill, statusToTone } from "@/components/status-pill";
import { supabase } from "@/integrations/supabase/client";
import { useStores, MARKETPLACES, type Store } from "@/lib/use-orders-data";
import { useWorkspace } from "@/lib/use-workspace";

export const Route = createFileRoute("/_app/marketplace")({
  head: () => ({ meta: [{ title: "Marketplace Connections — FlowOps" }] }),
  component: MarketplacePage,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function MarketplacePage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const ws = useWorkspace();
  const isManager = ws.data?.role === "Owner" || ws.data?.role === "Supervisor";
  const wid = ws.data?.workspace?.id;
  const stores = useStores();

  // Group stores by marketplace
  const byMarketplace = new Map<string, Store[]>();
  for (const s of stores.data ?? []) {
    if (!byMarketplace.has(s.marketplace)) byMarketplace.set(s.marketplace, []);
    byMarketplace.get(s.marketplace)!.push(s);
  }

  const connect = async (mp: string) => {
    if (!wid) return;
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
    toast.success(t("stores.toast.connected"));
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const disconnect = async (mp: string) => {
    const targets = byMarketplace.get(mp) ?? [];
    for (const s of targets) {
      await db.from("stores").update({ connection_status: "disconnected", last_sync_at: null }).eq("id", s.id);
    }
    toast.success(t("stores.toast.disconnected"));
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  const sync = async (mp: string) => {
    const targets = byMarketplace.get(mp) ?? [];
    for (const s of targets) {
      await db.from("stores").update({ last_sync_at: new Date().toISOString() }).eq("id", s.id);
    }
    toast.success(t("stores.toast.synced"));
    qc.invalidateQueries({ queryKey: ["stores"] });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("marketplace.title")} description={t("marketplace.description")} />

      <div className="grid gap-4 md:grid-cols-2">
        {MARKETPLACES.map((mp) => {
          const items = byMarketplace.get(mp) ?? [];
          const connected = items.some((s) => s.connection_status === "connected");
          const lastSync = items
            .map((s) => s.last_sync_at)
            .filter(Boolean)
            .sort()
            .reverse()[0];
          return (
            <div key={mp} className="rounded-lg border bg-card p-5 shadow-card">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-sm font-semibold">{mp}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {items.length
                      ? t("marketplace.storesCount", { count: items.length })
                      : t("marketplace.noStores")}
                  </div>
                </div>
                <StatusPill tone={statusToTone(connected ? "active" : "pending")}>
                  {connected ? t("marketplace.connected") : t("marketplace.disconnected")}
                </StatusPill>
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                {t("marketplace.lastSync")}:{" "}
                {lastSync ? new Date(lastSync as string).toLocaleString() : "—"}
              </div>
              {isManager && (
                <div className="mt-4 flex gap-2">
                  {connected ? (
                    <Button size="sm" variant="outline" onClick={() => disconnect(mp)}>
                      <Plug className="h-3.5 w-3.5" /> {t("marketplace.disconnect")}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => connect(mp)}>
                      <Plug className="h-3.5 w-3.5" /> {t("marketplace.connect")}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" disabled={!items.length} onClick={() => sync(mp)}>
                    <RefreshCw className="h-3.5 w-3.5" /> {t("marketplace.sync")}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
