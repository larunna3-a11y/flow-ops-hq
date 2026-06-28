import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { getInvitationByToken } from "@/lib/user-management.functions";

type InviteInfo = Awaited<ReturnType<typeof getInvitationByToken>>;

export const Route = createFileRoute("/accept-invite")({
  validateSearch: (s: Record<string, unknown>) => ({ token: String(s.token ?? "") }),
  head: () => ({ meta: [{ title: "Accept invitation — FlowOps" }] }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const { token } = useSearch({ from: "/accept-invite" });
  const navigate = useNavigate();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getInvitationByToken({ data: { token } });
        if (!cancelled) setInfo(res);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!info) return;
    const form = e.currentTarget as HTMLFormElement;
    const fd = new FormData(form);
    const email = String(fd.get("email") || "").trim();
    const password = String(fd.get("password") || "");
    if (!email || password.length < 8) {
      toast.error("Enter your email and a password (min 8 characters)");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: {
          full_name: info.full_name,
          invitation_token: token,
        },
      },
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Welcome to ${info.workspace_name}!`);
    navigate({ to: "/dashboard" });
  };

  const isExpired =
    info && (info.status !== "pending" || new Date(info.expires_at).getTime() < Date.now());

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-card">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground">
            <Boxes className="h-4 w-4" />
          </div>
          <span className="text-base font-semibold tracking-tight">FlowOps</span>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invitation…</p>
        ) : !info ? (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Invitation not found</h1>
            <p className="text-sm text-muted-foreground">
              This invitation link is invalid. Please contact your workspace Owner for a new one.
            </p>
            <Link to="/login" className="text-sm text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : isExpired ? (
          <div className="space-y-2">
            <h1 className="text-xl font-semibold">Invitation expired</h1>
            <p className="text-sm text-muted-foreground">
              Hi {info.full_name}, this invitation to {info.workspace_name} is no longer valid.
              Ask the Owner to send a new link.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold">You're invited to {info.workspace_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {info.full_name} · {info.role} · phone {info.phone}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Link expires {new Date(info.expires_at).toLocaleDateString()}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Your email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Create a password</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Creating account…" : "Accept invitation"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
