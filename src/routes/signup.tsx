import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Boxes, Check, ShieldCheck, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Get started — FlowOps" },
      {
        name: "description",
        content:
          "Create your FlowOps workspace. The first registered user becomes the workspace Owner.",
      },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const workspaceName = String(data.get("ws-name") || "").trim();
    const fullName = String(data.get("owner-name") || "").trim();
    const email = String(data.get("owner-email") || "").trim();
    const password = String(data.get("new-password") || "");

    if (!workspaceName || !fullName || !email || password.length < 8) {
      toast.error("Please complete every field (password ≥ 8 characters).");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { full_name: fullName, workspace_name: workspaceName },
      },
    });
    setLoading(false);

    if (error) {
      // Surfaces the trigger's "invitation required" message after first workspace exists.
      toast.error(error.message || "Could not create workspace.");
      return;
    }
    toast.success("Workspace created. Welcome aboard!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">FlowOps</span>
        </Link>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">Create your workspace</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            The first registered user becomes the workspace Owner.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input id="ws-name" placeholder="Northwind Logistics" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-name">Your name</Label>
              <Input id="owner-name" placeholder="Alex Morgan" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-email">Work email</Label>
              <Input id="owner-email" type="email" placeholder="you@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Create password</Label>
              <Input id="new-password" type="password" placeholder="At least 8 characters" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating workspace…" : "Create workspace as Owner"}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">© FlowOps {new Date().getFullYear()}</p>
      </div>

      {/* Right — pitch */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-glow p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
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
            Join operations teams running their entire warehouse on a single workspace.
          </p>
        </div>

        <div className="relative space-y-4">
          {[
            { icon: Zap, title: "Live in minutes", desc: "No installation, no setup calls." },
            { icon: Users, title: "Invite your team", desc: "Owner, Supervisor, Packer, Returns." },
            { icon: ShieldCheck, title: "Secure by default", desc: "Role-based access on every action." },
            { icon: Check, title: "Free to start", desc: "Upgrade when your team is ready." },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10 backdrop-blur">
                <f.icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="text-xs text-primary-foreground/80">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
