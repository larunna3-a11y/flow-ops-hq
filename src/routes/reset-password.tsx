import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Boxes } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [{ title: "Reset password — FlowOps" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase places the recovery session in the URL hash; the client picks it up.
    const sub = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.data.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const password = String(data.get("password") || "");
    const confirm = String(data.get("confirm") || "");
    if (password.length < 8) return toast.error(t("auth.reset.weak"));
    if (password !== confirm) return toast.error(t("auth.reset.mismatch"));
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(t("auth.reset.success"));
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Link to="/" className="mb-8 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
          <Boxes className="h-4 w-4" />
        </div>
        <span className="text-base font-semibold tracking-tight">FlowOps</span>
      </Link>
      <div className="w-full max-w-sm rounded-lg border bg-card p-6 shadow-card">
        <h1 className="text-xl font-semibold tracking-tight">{t("auth.reset.title")}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{t("auth.reset.subtitle")}</p>
        {ready ? (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{t("auth.reset.newPassword")}</Label>
              <Input id="password" name="password" type="password" autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t("auth.reset.confirm")}</Label>
              <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.sending") : t("auth.reset.submit")}
            </Button>
          </form>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">{t("auth.reset.waiting")}</p>
        )}
      </div>
    </div>
  );
}
