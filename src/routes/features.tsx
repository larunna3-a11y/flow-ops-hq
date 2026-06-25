import { createFileRoute, Link } from "@tanstack/react-router";
import {
  PackageCheck,
  ScanLine,
  RotateCcw,
  BarChart3,
  ShieldCheck,
  Users,
  ArrowRight,
  Check,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing-shell";

export const Route = createFileRoute("/features")({
  head: () => ({
    meta: [
      { title: "Features — FlowOps" },
      {
        name: "description",
        content:
          "Explore FlowOps modules: packing operations, barcode and QR scanning, return management, reports and role-based access.",
      },
      { property: "og:title", content: "Features — FlowOps" },
      {
        property: "og:description",
        content:
          "Packing, scanning, returns, analytics and role-based access — the modules that run modern warehouses.",
      },
    ],
  }),
  component: FeaturesPage,
});

const ICONS = {
  packing: PackageCheck,
  scanning: ScanLine,
  returns: RotateCcw,
  reports: BarChart3,
  rbac: ShieldCheck,
  invites: Users,
} as const;

function FeaturesPage() {
  const { t } = useTranslation();
  const keys = ["packing", "scanning", "returns", "reports", "rbac", "invites"] as const;
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("features.eyebrow")}
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            {t("features.title")}
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {keys.map((k) => {
            const Icon = ICONS[k];
            const points = t(`features.modules.${k}.points`, { returnObjects: true }) as string[];
            return (
              <div
                key={k}
                className="rounded-xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-elegant"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-4 text-lg font-semibold">{t(`features.modules.${k}.title`)}</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(`features.modules.${k}.desc`)}</p>
                <ul className="mt-4 space-y-2">
                  {points.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-16 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/signup">
              {t("features.ctaStart")} <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/pricing">{t("features.ctaPricing")}</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
