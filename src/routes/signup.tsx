import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Boxes, Check, ShieldCheck, Users, Zap } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LanguageSwitcher } from "@/components/language-switcher";

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
  const { t } = useTranslation();
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
      toast.error(t("auth.errors.completeFields"));
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
      toast.error(error.message || t("auth.errors.couldNotCreate"));
      return;
    }
    toast.success(t("auth.success.workspaceCreated"));
    navigate({ to: "/dashboard" });
  };

  const pitchKeys = ["live", "invite", "secure", "free"] as const;
  const pitchIcons = { live: Zap, invite: Users, secure: ShieldCheck, free: Check };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">FlowOps</span>
          </Link>
          <LanguageSwitcher variant="marketing" />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.signup.title")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("auth.signup.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">{t("auth.signup.workspaceName")}</Label>
              <Input id="ws-name" name="ws-name" placeholder={t("auth.signup.workspaceNamePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-name">{t("auth.signup.yourName")}</Label>
              <Input id="owner-name" name="owner-name" placeholder={t("auth.signup.yourNamePlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-email">{t("auth.signup.email")}</Label>
              <Input id="owner-email" name="owner-email" type="email" placeholder={t("auth.signup.emailPlaceholder")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">{t("auth.signup.password")}</Label>
              <Input id="new-password" name="new-password" type="password" placeholder={t("auth.signup.passwordPlaceholder")} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.creating") : t("auth.signup.submit")}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wide">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const res = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: `${window.location.origin}/dashboard`,
                });
                if (res?.error) {
                  setLoading(false);
                  toast.error(res.error.message || "Google sign-up failed");
                }
              }}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t("auth.signup.alreadyHave")}{" "}
              <Link to="/login" className="font-medium text-primary hover:underline">
                {t("auth.signup.signIn")}
              </Link>
            </p>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">{t("auth.signup.copyright", { year: new Date().getFullYear() })}</p>
      </div>

      {/* Right — pitch */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-primary-glow p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-xs font-medium backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-white" /> {t("auth.signup.pitchBadge")}
          </div>
          <h2 className="mt-8 max-w-md text-3xl font-semibold leading-tight tracking-tight">
            {t("auth.signup.pitchTitle")}
          </h2>
          <p className="mt-4 max-w-md text-sm text-primary-foreground/85">
            {t("auth.signup.pitchSubtitle")}
          </p>
        </div>

        <div className="relative space-y-4">
          {pitchKeys.map((k) => {
            const Icon = pitchIcons[k];
            return (
              <div key={k} className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/25 bg-white/10 backdrop-blur">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">{t(`auth.signup.pitch.${k}.title`)}</div>
                  <div className="text-xs text-primary-foreground/80">{t(`auth.signup.pitch.${k}.desc`)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.8 32.6 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 6.2 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.2 7.2 29.4 5 24 5 16.3 5 9.6 9.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.3 0 10.1-2 13.7-5.3l-6.3-5.2C29.3 35 26.8 36 24 36c-5.3 0-9.8-3.4-11.3-8.1l-6.5 5C9.4 39.6 16.1 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.7 2-2 3.8-3.6 5.2l6.3 5.2C41.6 35.4 44 30.1 44 24c0-1.2-.1-2.3-.4-3.5z"/>
    </svg>
  );
}
