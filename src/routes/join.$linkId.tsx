import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useInvitationLinkPublic, acceptInvitationLink } from "@/lib/invitation-links";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$linkId")({
  component: JoinPage,
});

function JoinPage() {
  const { linkId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const linkQuery = useInvitationLinkPublic(linkId);
  const link = linkQuery.data;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [acceptingTerms, setAcceptingTerms] = useState(false);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        // User already logged in, redirect to dashboard
        navigate({ to: "/dashboard" });
      }
    };
    checkAuth();
  }, [navigate]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!link) {
      setError("Invitation link is invalid or has expired");
      return;
    }

    // Validation
    if (!fullName.trim()) {
      setError("Full name is required");
      return;
    }
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password) {
      setError("Password is required");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!acceptingTerms) {
      setError("You must accept the terms to continue");
      return;
    }

    setJoining(true);
    try {
      const result = await acceptInvitationLink({
        linkId,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });

      if (!result.success) {
        setError(result.message);
        setJoining(false);
        return;
      }

      // Sign in automatically after successful signup
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        toast.error("Account created but automatic sign-in failed. Please log in manually.");
        navigate({ to: "/login" });
        return;
      }

      // Invalidate workspace query to refresh workspace data
      qc.invalidateQueries({ queryKey: ["current-workspace"] });

      toast.success(result.message);
      navigate({ to: "/dashboard" });
    } catch (e) {
      const message = e instanceof Error ? e.message : "An error occurred";
      setError(message);
    } finally {
      setJoining(false);
    }
  };

  if (linkQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (!link) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
        <div className="max-w-md w-full space-y-6">
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
            <h1 className="text-lg font-semibold">Invalid or Expired Link</h1>
            <p className="text-sm text-muted-foreground mt-2">
              This invitation link is no longer valid. Please contact your workspace administrator for a new link.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
              <Boxes className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Join FlowOps</h1>
            <p className="text-sm text-muted-foreground mt-1">
              You've been invited as a <span className="font-medium text-foreground">{link.role}</span>
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="rounded-lg border bg-card p-6 shadow-card space-y-4">
          <form onSubmit={handleJoin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="e.g., John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={joining}
                required
              />
              <p className="text-xs text-muted-foreground">
                This will be your name in FlowOps. You can change it later.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={joining}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={joining}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={joining}
                required
              />
            </div>

            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="terms"
                checked={acceptingTerms}
                onChange={(e) => setAcceptingTerms(e.target.checked)}
                disabled={joining}
                className="mt-1 rounded border border-input"
              />
              <Label htmlFor="terms" className="text-xs cursor-pointer">
                I agree to the{" "}
                <a href="#" className="text-primary hover:underline">
                  Terms of Service
                </a>{" "}
                and{" "}
                <a href="#" className="text-primary hover:underline">
                  Privacy Policy
                </a>
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={joining || !link}>
              {joining && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {joining ? "Creating Account..." : "Join FlowOps"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-card px-2 text-muted-foreground">Already have an account?</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate({ to: "/login" })}
            disabled={joining}
          >
            Sign In
          </Button>
        </div>

        {/* Info Box */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
          <div className="flex gap-2">
            <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-medium text-foreground">You're all set!</p>
              <p className="text-muted-foreground">
                Once you create your account, you'll be automatically added to your workspace with the{" "}
                <span className="font-medium">{link.role}</span> role.
              </p>
            </div>
          </div>
        </div>

        {/* Link expiry info */}
        <div className="text-center text-xs text-muted-foreground">
          <p>This invitation link expires {new Date(link.expires_at).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}
