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

const modules = [
  {
    icon: PackageCheck,
    title: "Packing operations",
    desc: "A live queue that surfaces the next order to pack with SLA-aware priority, per-packer performance and station context.",
    points: [
      "Live order queue with priority filters",
      "Per-packer throughput & accuracy",
      "Station and shift context",
      "SLA breach early warnings",
    ],
  },
  {
    icon: ScanLine,
    title: "Barcode & QR scan tracking",
    desc: "Every scan event captured with timestamp, user, station and outcome — a complete operational audit trail.",
    points: [
      "Scanner-ready event capture",
      "Full audit trail by SKU and order",
      "Mismatch & exception logging",
      "Searchable scan history",
    ],
  },
  {
    icon: RotateCcw,
    title: "Return management",
    desc: "From RMA intake to inspection grading to resolution — the entire return lifecycle in one workflow.",
    points: [
      "RMA intake & customer context",
      "Inspection grading & photos",
      "Refund / restock / discard outcomes",
      "Return rate analytics",
    ],
  },
  {
    icon: BarChart3,
    title: "Reporting & analytics",
    desc: "Marketplace mix, courier KPIs and user productivity reporting — refreshed in real time.",
    points: [
      "Marketplace mix & volume",
      "Courier SLA & cost reports",
      "User productivity dashboards",
      "Export to CSV",
    ],
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    desc: "Owner, Supervisor, Packer and Return Staff — each role scoped to the modules and actions they need.",
    points: [
      "Four built-in roles",
      "Workspace-level isolation",
      "Granular module access",
      "Audit log of admin actions",
    ],
  },
  {
    icon: Users,
    title: "Workspace & invites",
    desc: "First registered user becomes Owner. After that, members join by invite only — no public sign-up.",
    points: [
      "Single workspace per account",
      "Owner-controlled invites",
      "Email-based onboarding",
      "Member status & deactivation",
    ],
  },
];

function FeaturesPage() {
  return (
    <MarketingShell>
      <section className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Features
          </div>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything your warehouse needs in one workspace.
          </h1>
          <p className="mt-4 text-base text-muted-foreground sm:text-lg">
            Six built-in modules that replace the spreadsheets, sticky notes and disconnected
            tools your team uses today.
          </p>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {modules.map((m) => (
            <div
              key={m.title}
              className="rounded-xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-elegant"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <m.icon className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-lg font-semibold">{m.title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{m.desc}</p>
              <ul className="mt-4 space-y-2">
                {m.points.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/signup">
              Start free <ArrowRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/pricing">See pricing</Link>
          </Button>
        </div>
      </section>
    </MarketingShell>
  );
}
