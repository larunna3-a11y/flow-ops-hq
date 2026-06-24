import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, ArrowRight } from "lucide-react";
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

const plans = [
  {
    name: "Starter",
    price: "$0",
    cadence: "/mo",
    desc: "For small teams getting set up.",
    features: [
      "1 workspace",
      "Up to 3 users",
      "Packing & scanning modules",
      "Basic reports",
      "Community support",
    ],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Growth",
    price: "$49",
    cadence: "/mo",
    desc: "For scaling e-commerce operations.",
    features: [
      "Unlimited users",
      "All operations modules",
      "Advanced analytics",
      "Return workflows",
      "Priority email support",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Scale",
    price: "Custom",
    cadence: "",
    desc: "For multi-warehouse operations.",
    features: [
      "Multi-warehouse",
      "SSO & audit logs",
      "Dedicated CSM",
      "Custom integrations",
      "99.9% uptime SLA",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

const compare = [
  { label: "Users", values: ["3", "Unlimited", "Unlimited"] },
  { label: "Packing & Scanning", values: ["Included", "Included", "Included"] },
  { label: "Return management", values: ["—", "Included", "Included"] },
  { label: "Advanced analytics", values: ["—", "Included", "Included"] },
  { label: "Multi-warehouse", values: ["—", "—", "Included"] },
  { label: "SSO & audit logs", values: ["—", "—", "Included"] },
  { label: "Support", values: ["Community", "Priority email", "Dedicated CSM"] },
];

function PricingPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Pricing
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple pricing that scales with your shipping volume.
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Start free. Upgrade when your team is ready. No hidden fees.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-xl border bg-card p-6 ${
                p.highlight ? "border-primary shadow-elegant" : "border-border shadow-card"
              }`}
            >
              {p.highlight && (
                <div className="absolute -top-3 right-6 inline-flex h-6 items-center rounded-full bg-gradient-to-r from-primary to-primary-glow px-2.5 text-xs font-semibold text-primary-foreground">
                  Most popular
                </div>
              )}
              <div className="text-sm font-semibold">{p.name}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                <span className="text-sm text-muted-foreground">{p.cadence}</span>
              </div>
              <p className="mt-1.5 text-sm text-muted-foreground">{p.desc}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-6" variant={p.highlight ? "default" : "outline"}>
                <Link to="/signup">
                  {p.cta} <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ))}
        </div>

        {/* Comparison */}
        <div className="mt-20">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Compare plans</h2>
          <div className="mt-8 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    Feature
                  </th>
                  {plans.map((p) => (
                    <th key={p.name} className="px-4 py-3 text-left font-medium">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compare.map((row) => (
                  <tr key={row.label} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-muted-foreground">{row.label}</td>
                    {row.values.map((v, i) => (
                      <td key={i} className="px-4 py-3 font-medium">
                        {v}
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
