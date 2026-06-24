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
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-gradient-to-br from-primary/20 via-primary-glow/10 to-transparent blur-3xl" />
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-primary" />
            New — Real-time packing analytics
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Warehouse operations,{" "}
            <span className="bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              finally in flow.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
            FlowOps unifies packing, scanning, returns and reporting in a single workspace built
            for e-commerce brands, marketplace sellers and warehouse teams.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/signup">
                Start free <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/features">See how it works</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            No credit card required · Invite-only workspace · Cancel anytime
          </p>
        </div>

        {/* Product preview */}
        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="rounded-xl border border-border bg-card p-2 shadow-elegant">
            <div className="flex items-center gap-1.5 px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
              <span className="ml-3 text-xs text-muted-foreground">app.flowops.io/dashboard</span>
            </div>
            <div className="grid grid-cols-12 gap-2 rounded-lg bg-gradient-to-br from-muted/60 to-background p-3">
              <div className="col-span-3 hidden rounded-md border border-border bg-card p-3 sm:block">
                <div className="mb-3 flex items-center gap-2">
                  <Boxes className="h-4 w-4 text-primary" />
                  <span className="text-xs font-semibold">FlowOps</span>
                </div>
                {["Dashboard", "Packing", "Scanning", "Returns", "Reports"].map((i, idx) => (
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
                  { label: "Orders packed", value: "1,284", delta: "+12%" },
                  { label: "Avg pack time", value: "1m 42s", delta: "-8%" },
                  { label: "Return rate", value: "3.2%", delta: "-0.4%" },
                ].map((s) => (
                  <div key={s.label} className="rounded-md border border-border bg-card p-3">
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {s.label}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{s.value}</div>
                    <div className="text-[10px] text-success">{s.delta} vs last week</div>
                  </div>
                ))}
                <div className="col-span-3 h-32 rounded-md border border-border bg-card p-3">
                  <div className="mb-2 text-xs font-medium">Packing throughput</div>
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
  return (
    <section className="border-y border-border/60 bg-muted/20 py-8">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Trusted by operations teams shipping millions of orders
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
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Product overview
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            One workspace for every motion of your warehouse.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            FlowOps replaces the spreadsheets, sticky notes and disconnected tools your team uses
            to pack, scan and process returns. Everything flows into the same operational record,
            visible to owners, supervisors, packers and return staff.
          </p>
          <ul className="mt-6 space-y-3">
            {[
              "Live packing queue with SLA-aware prioritisation",
              "Barcode and QR scan audit trail (scanner-ready)",
              "Return inspection workflow with resolution outcomes",
              "Marketplace, courier and user productivity reporting",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: PackageCheck, label: "Packing Ops" },
            { icon: ScanLine, label: "Scan Tracking" },
            { icon: RotateCcw, label: "Returns" },
            { icon: BarChart3, label: "Reports" },
          ].map((m) => (
            <div
              key={m.label}
              className="rounded-xl border border-border bg-card p-5 shadow-card transition-shadow hover:shadow-elegant"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </div>
              <div className="mt-3 text-sm font-semibold">{m.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Built-in module, ready on day one.
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const features = [
  {
    icon: PackageCheck,
    title: "Packing operations",
    desc: "Live queue, priority filters and per-packer performance, so the right order is always next.",
  },
  {
    icon: ScanLine,
    title: "Barcode & QR tracking",
    desc: "Every scan event captured with timestamp, user and station — a complete audit trail.",
  },
  {
    icon: RotateCcw,
    title: "Return management",
    desc: "RMA intake, inspection grading and resolution outcomes, all in one workflow.",
  },
  {
    icon: BarChart3,
    title: "Reports & analytics",
    desc: "Marketplace mix, courier KPIs and user productivity, refreshed in real time.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    desc: "Owner, Supervisor, Packer and Return Staff — scoped to what each role actually needs.",
  },
  {
    icon: Users,
    title: "Workspace invites",
    desc: "First registered user becomes Owner. No public sign-up — invite only, by design.",
  },
];

function Features() {
  return (
    <section id="features" className="bg-muted/30 py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Features
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything operations teams need, nothing they don't.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Built from the floor up for warehouses that ship — not adapted from a generic ERP.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-elegant"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const steps = [
  {
    icon: Zap,
    title: "Create your workspace",
    desc: "Sign up in seconds. The first user becomes the workspace Owner.",
  },
  {
    icon: Users,
    title: "Invite your team",
    desc: "Add Supervisors, Packers and Return Staff with role-based access.",
  },
  {
    icon: Truck,
    title: "Ship with confidence",
    desc: "Run packing, scanning and returns from one operational record.",
  },
];

function HowItWorks() {
  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">
          How it works
        </div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          From spreadsheet to shipping floor in under an hour.
        </h2>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {steps.map((s, idx) => (
          <div key={s.title} className="relative rounded-xl border border-border bg-card p-6">
            <div className="absolute -top-3 left-6 inline-flex h-6 items-center rounded-full bg-primary px-2.5 text-xs font-semibold text-primary-foreground">
              Step {idx + 1}
            </div>
            <div className="mt-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </div>
            <h3 className="mt-4 text-base font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const plans = [
  {
    name: "Starter",
    price: "$0",
    cadence: "/mo",
    desc: "For small teams getting set up.",
    features: ["1 workspace", "Up to 3 users", "Packing & scanning", "Basic reports"],
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
      "Priority support",
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
      "99.9% SLA",
    ],
    cta: "Contact sales",
    highlight: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="bg-muted/30 py-24">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            Pricing
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple pricing that scales with your shipping volume.
          </h2>
          <p className="mt-4 text-base text-muted-foreground">
            Start free. Upgrade when your team is ready.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`relative flex flex-col rounded-xl border bg-card p-6 ${
                p.highlight
                  ? "border-primary shadow-elegant"
                  : "border-border shadow-card"
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
              <Button
                asChild
                className="mt-6"
                variant={p.highlight ? "default" : "outline"}
              >
                <Link to="/signup">{p.cta}</Link>
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const faqs = [
  {
    q: "Who is FlowOps for?",
    a: "Operations teams at e-commerce brands, marketplace sellers and 3PL warehouses that need to coordinate packing, scanning and returns in one place.",
  },
  {
    q: "Can anyone sign up?",
    a: "The first registered user creates and owns a workspace. After that, new members join by invite only — there is no public sign-up into an existing workspace.",
  },
  {
    q: "What roles are supported?",
    a: "Owner, Supervisor, Packer and Return Staff. Each role has scoped access to the modules and actions they need.",
  },
  {
    q: "Does FlowOps support barcode scanners?",
    a: "Yes. The scan tracking module is scanner-ready and records every event with a full audit trail. Hardware integration is on the upcoming roadmap.",
  },
  {
    q: "Which marketplaces do you integrate with?",
    a: "Marketplace integrations are on our near-term roadmap. Today you can import orders and run reporting on marketplace mix using mock or uploaded data.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Paid plans are month-to-month and can be cancelled from your workspace settings.",
  },
];

function FAQ() {
  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-24 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="text-xs font-semibold uppercase tracking-wider text-primary">FAQ</div>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Frequently asked questions
        </h2>
      </div>
      <Accordion type="single" collapsible className="mt-10">
        {faqs.map((f) => (
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
  return (
    <section className="mx-auto w-full max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary via-primary to-primary-glow p-10 text-primary-foreground shadow-elegant sm:p-14">
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Ready to bring your warehouse into flow?
          </h2>
          <p className="mt-3 text-sm text-primary-foreground/85 sm:text-base">
            Create your workspace in under a minute. Invite your team. Start shipping smarter
            today.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" variant="secondary">
              <Link to="/signup">
                Get started free <ArrowRight className="ml-1.5 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
            >
              <Link to="/login">I already have an account</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
