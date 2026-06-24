import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Boxes, ArrowRight, ShieldCheck, BarChart3, ScanLine, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sign in — FlowOps" },
      { name: "description", content: "Sign in to your FlowOps workspace to manage packing, scanning and returns." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => navigate({ to: "/dashboard" }), 400);
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
            <Boxes className="h-4.5 w-4.5" />
          </div>
          <span className="text-base font-semibold tracking-tight">FlowOps</span>
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Sign in to your workspace, or create a new one to get started.
          </p>

          <Tabs defaultValue="signin" className="mt-8">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="create">Create workspace</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="workspace">Workspace</Label>
                  <Input id="workspace" defaultValue="northwind" placeholder="your-workspace" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Work email</Label>
                  <Input id="email" type="email" defaultValue="alex@flowops.io" placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input id="password" type="password" defaultValue="••••••••" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Signing in…" : "Sign in"}
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  No public sign-up. New members join by invite only.
                </p>
              </form>
            </TabsContent>

            <TabsContent value="create">
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ws-name">Workspace name</Label>
                  <Input id="ws-name" placeholder="Northwind Logistics" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="owner-email">Your email</Label>
                  <Input id="owner-email" type="email" placeholder="you@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">Create password</Label>
                  <Input id="new-password" type="password" placeholder="At least 8 characters" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  Create workspace as Owner
                  <ArrowRight className="ml-1.5 h-4 w-4" />
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  The first registered user becomes the workspace Owner.
                </p>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-xs text-muted-foreground">© FlowOps {new Date().getFullYear()}</p>
      </div>

      {/* Right — pitch */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-glow p-12 text-primary-foreground">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> Warehouse Operations
          </div>
          <h2 className="mt-8 max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Pack faster, ship cleaner, return smarter.
          </h2>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/85">
            FlowOps unifies packing, scanning, returns and reporting in a single workspace built
            for modern e-commerce and marketplace teams.
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-3">
          {[
            { icon: PackageCheck, title: "Packing ops", desc: "Real-time queue & SLAs" },
            { icon: ScanLine, title: "Scan tracking", desc: "Barcode + QR audit trail" },
            { icon: BarChart3, title: "Analytics", desc: "Marketplace & courier KPIs" },
            { icon: ShieldCheck, title: "Role-based", desc: "Owner, Supervisor, Packer" },
          ].map((f) => (
            <div key={f.title} className="rounded-lg border border-white/20 bg-white/10 p-4 backdrop-blur">
              <f.icon className="h-4 w-4" />
              <div className="mt-2 text-sm font-semibold">{f.title}</div>
              <div className="text-xs text-primary-foreground/80">{f.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
