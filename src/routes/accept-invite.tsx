import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import {
  acceptInvitation,
  getInvitationByToken,
} from "@/lib/user-management.functions";
import { HOME_PATH } from "@/lib/permissions";

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
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await getInvitationByToken({ data: { token } });
        if (!cancelled) {
          setInfo(res);
          if (res?.full_name) setFullName(res.full_name);
        }
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
    const name = fullName.trim();
    if (name.length < 2) {
      toast.error("Please enter your full name");
      return;
    }
    setSubmitting(true);
    try {
      // Make sure no stale session is attached when we sign the invitee in.
      await supabase.auth.signOut().catch(() => undefined);

      const creds = await acceptInvitation({ data: { token, fullName: name } });
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });
      if (signInErr) throw signInErr;

      toast.success(`Welcome to ${info.workspace_name}!`);
      navigate({ to: HOME_PATH[creds.role] ?? "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not accept invitation");
    } finally {
      setSubmitting(false);
    }
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
            <h1 className="text-xl font-semibold">
              {info.status === "accepted"
                ? "Invitation already used"
                : info.status === "revoked"
                  ? "Invitation revoked"
                  : "Invitation expired"}
            </h1>
            <p className="text-sm text-muted-foreground">
              This invitation to {info.workspace_name} is no longer valid. Ask the Owner to
              send a new link.
            </p>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-semibold">You're invited to {info.workspace_name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Role: <span className="font-medium text-foreground">{info.role}</span>
              {info.phone ? <> · {info.phone}</> : null}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Link expires {new Date(info.expires_at).toLocaleDateString()}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="full-name">Your full name</Label>
                <Input
                  id="full-name"
                  name="full-name"
                  autoFocus
                  required
                  minLength={2}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Aulia Rahman"
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Joining workspace…" : "Accept invitation & continue"}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                No password required. You'll be signed in automatically.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
