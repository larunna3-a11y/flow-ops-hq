import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  PackageCheck,
  ScanLine,
  RotateCcw,
  BarChart3,
  ShieldCheck,
  Users,
  Check,
  Sparkles,
  Boxes,
  Zap,
  Truck,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { MarketingShell } from "@/components/marketing-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlowOps — Warehouse operations for modern e-commerce" },
      {
        name: "description",
        content:
          "FlowOps unifies packing, scanning, returns and analytics in one workspace built for e-commerce brands, marketplace sellers and warehouse teams.",
      },
      { property: "og:title", content: "FlowOps — Warehouse operations for modern e-commerce" },
      {
        property: "og:description",
        content:
          "Pack faster, ship cleaner, return smarter. The operations platform for modern warehouses.",
      },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <MarketingShell>
      <Hero />
      <LogosStrip />
      <Overview />
      <Features />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <CTA />
    </MarketingShell>
  );
}

function Hero() {
  const { t } = useTranslation();
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/20 via-primary-glow/10 to-transparent blur-3xl" />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            {t("landing.hero.badge")}
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t("landing.hero.titleLead")}{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {t("landing.hero.titleAccent")}
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/signup">
                {t("landing.hero.ctaPrimary")} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/features">{t("landing.hero.ctaSecondary")}</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            {t("landing.hero.footnote")}
          </p>
        </div>

        {/* Product preview */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="rounded-xl border border-border bg-card p-2 shadow-elegant">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-3 text-xs text-muted-foreground">{t("landing.hero.previewUrl")}</span>
            </div>
            <div className="grid grid-cols-12 gap-2 rounded-lg bg-gradient-to-br from-muted/60 to-background p-3">
              <div className="col-span-3 hidden rounded-md border border-border bg-card p-3 sm:block">
                <div className="mb-3 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">FlowOps</span>
                </div>
                {[
                  t("sidebar.items.dashboard"),
                  t("sidebar.items.packing"),
                  t("sidebar.items.scanning"),
                  t("sidebar.items.returns"),
                  t("sidebar.items.reports"),
                ].map((i, idx) => (
                  <div
                    key={i}
                    className={`mb-1 rounded px-2 py-1.5 text-xs ${
                      idx === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {i}
                  </div>
                ))}
              </div>
              <div className="col-span-12 grid grid-cols-3 gap-2 sm:col-span-9">
                {[
                  { label: t("landing.hero.stat1"), value: "1,284", delta: t("landing.hero.deltaUp") },
                  { label: t("landing.hero.stat2"), value: "1m 42s", delta: t("landing.hero.deltaDown1") },
                  { label: t("landing.hero.stat3"), value: "3.2%", delta: t("landing.hero.deltaDown2") },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border border-border bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{s.value}</div>
                    <div className="text-[10px] text-success">{s.delta} {t("landing.hero.deltaVsLastWeek")}</div>
                  </div>
                ))}
                <div className="col-span-3 h-32 rounded-md border border-border bg-card p-3">
                  <div className="mb-2 text-xs font-medium">{t("landing.hero.throughput")}</div>
                  <div className="flex h-20 items-end gap-1.5">
                    {[40, 65, 55, 80, 72, 90, 78, 95, 88, 96, 82, 100].map((h, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-sm bg-gradient-to-t from-primary to-primary-glow"
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function LogosStrip() {
  const { t } = useTranslation();
  return (
    <section className="border-y border-border/60 bg-muted/20 py-8">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("landing.logos.trustedBy")}
        </p>
        <div className="mt-5 grid grid-cols-2 items-center justify-items-center gap-6 opacity-70 sm:grid-cols-3 md:grid-cols-6">
          {["NORTHWIND", "PARCELY", "STOCKADE", "SHIPLY", "CRATEHOUSE", "PALLETIQ"].map((l) => (
            <div key={l} className="text-sm font-semibold tracking-widest text-muted-foreground">
              {l}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Overview() {
  const { t } = useTranslation();
  const bullets = t("landing.overview.bullets", { returnObjects: true }) as string[];
  const modules = [
    { icon: PackageCheck, label: t("landing.overview.moduleLabels.packing") },
    { icon: ScanLine, label: t("landing.overview.moduleLabels.scanning") },
    { icon: RotateCcw, label: t("landing.overview.moduleLabels.returns") },
    { icon: BarChart3, label: t("landing.overview.moduleLabels.reports") },
  ];
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("landing.overview.eyebrow")}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.overview.title")}
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            {t("landing.overview.body")}
          </p>
          <ul className="mt-6 space-y-3">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {modules.map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elegant"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-semibold">{m.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {t("landing.overview.moduleHint")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const { t } = useTranslation();
  const keys = ["packing", "scanning", "returns", "reports", "rbac", "invites"] as const;
  const icons = { packing: PackageCheck, scanning: ScanLine, returns: RotateCcw, reports: BarChart3, rbac: ShieldCheck, invites: Users };
  return (
    <section id="features" className="bg-muted/30 py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("landing.features.eyebrow")}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.features.title")}
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            {t("landing.features.subtitle")}
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {keys.map((k) => {
            const Icon = icons[k];
            return (
              <div
                key={k}
                className="group rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold">{t(`landing.features.items.${k}.title`)}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(`landing.features.items.${k}.desc`)}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useTranslation();
  const steps = [
    { icon: Zap, key: "create" },
    { icon: Users, key: "invite" },
    { icon: Truck, key: "ship" },
  ] as const;
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          {t("landing.howItWorks.eyebrow")}
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("landing.howItWorks.title")}
        </h2>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s, idx) => (
          <div key={s.key} className="relative rounded-xl border border-border bg-card p-6">
            <div className="absolute -top-3 left-6 inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
              {t("landing.howItWorks.step", { n: idx + 1 })}
            </div>
            <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">{t(`landing.howItWorks.steps.${s.key}.title`)}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{t(`landing.howItWorks.steps.${s.key}.desc`)}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Pricing() {
  const { t } = useTranslation();
  const planKeys = ["starter", "growth", "scale"] as const;
  return (
    <section id="pricing" className="bg-muted/30 py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {t("landing.pricing.eyebrow")}
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.pricing.title")}
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            {t("landing.pricing.subtitle")}
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
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
                    {t("landing.pricing.mostPopular")}
                  </div>
                )}
                <div className="text-sm font-semibold">{t(`pricing.plans.${k}.name`)}</div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">{t(`pricing.plans.${k}.price`)}</span>
                  <span className="text-sm text-muted-foreground">{t(`pricing.plans.${k}.cadence`)}</span>
                </div>
                <p className="mt-1.5 text-sm text-muted-foreground">{t(`pricing.plans.${k}.desc`)}</p>
                <ul className="mt-5 flex-1 space-y-2.5">
                  {features.slice(0, 4).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-6" variant={highlight ? "default" : "outline"}>
                  <Link to="/signup">{t(`pricing.plans.${k}.cta`)}</Link>
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useTranslation();
  const items = t("landing.faq.items", { returnObjects: true }) as { q: string; a: string }[];
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">{t("landing.faq.eyebrow")}</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("landing.faq.title")}
        </h2>
      </div>
      <Accordion type="single" collapsible className="mt-10">
        {items.map((f) => (
          <AccordionItem key={f.q} value={f.q}>
            <AccordionTrigger className="text-left text-base font-medium">
              {f.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {f.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

function CTA() {
  const { t } = useTranslation();
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-primary-glow p-10 text-primary-foreground shadow-elegant sm:p-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("landing.cta.title")}
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/85 sm:text-base">
            {t("landing.cta.subtitle")}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary">
              <Link to="/signup">
                {t("landing.cta.primary")} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            >
              <Link to="/login">{t("landing.cta.secondary")}</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
