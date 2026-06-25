import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — FlowOps" },
      {
        name: "description",
        content:
          "Simple, transparent pricing for FlowOps. Start free, upgrade when your team is ready. Plans for every warehouse size.",
      },
      { property: "og:title", content: "Pricing — FlowOps" },
      {
        property: "og:description",
        content: "Free to start. Scales with your shipping volume. No hidden fees.",
      },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const { t } = useTranslation();
  const planKeys = ["starter", "growth", "scale"] as const;
  const compareRows = [
    { label: t("pricing.compare.users"), key: "users" },
    { label: t("pricing.compare.packingScanning"), key: "packingScanning" },
    { label: t("pricing.compare.returns"), key: "returns" },
    { label: t("pricing.compare.analytics"), key: "analytics" },
    { label: t("pricing.compare.multiWarehouse"), key: "multiWarehouse" },
    { label: t("pricing.compare.sso"), key: "sso" },
    { label: t("pricing.compare.support"), key: "support" },
  ];
  const v = (key: string) => t(`pricing.compare.values.${key}`);
  const compareMatrix: Record<string, string[]> = {
    users: ["3", v("unlimited"), v("unlimited")],
    packingScanning: [v("included"), v("included"), v("included")],
    returns: [v("none"), v("included"), v("included")],
    analytics: [v("none"), v("included"), v("included")],
    multiWarehouse: [v("none"), v("none"), v("included")],
    sso: [v("none"), v("none"), v("included")],
    support: [v("community"), v("priorityEmail"), v("dedicatedCsm")],
  };

  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("pricing.eyebrow")}
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("pricing.title")}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {planKeys.map((k) => {
            const highlight = k === "growth";
            const features = t(`pricing.plans.${k}.features`, { returnObjects: true }) as string[];
            return (
              <div
                key={k}
                className={`relative flex flex-col rounded-xl border bg-card p-6 ${
                  highlight ? "border-primary shadow-elegant" : "border-border shadow-card"
                }`}
              >
                {highlight && (
                  <div className="absolute -top-3 right-6 inline-flex h-6 items-center rounded-full bg-gradient-to-r from-primary to-primary-glow px-2.5 text-xs font-semibold text-primary-foreground">
                    {t("pricing.mostPopular")}
                  </div>
                )}
                <div className="text-sm font-semibold">{t(`pricing.plans.${k}.name`)}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{t(`pricing.plans.${k}.price`)}</span>
                  <span className="text-sm text-muted-foreground">{t(`pricing.plans.${k}.cadence`)}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(`pricing.plans.${k}.desc`)}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6" variant={highlight ? "default" : "outline"}>
                  <Link to="/signup">
                    {t(`pricing.plans.${k}.cta`)} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Comparison */}
        <div className="mt-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight">{t("pricing.compareTitle")}</h2>
          <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    {t("pricing.compareFeature")}
                  </th>
                  {planKeys.map((k) => (
                    <th key={k} className="px-4 py-3 text-left font-medium">
                      {t(`pricing.plans.${k}.name`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.key} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                    {compareMatrix[row.key].map((val, i) => (
                      <td key={i} className="px-4 py-3 font-medium">
                        {val}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}
