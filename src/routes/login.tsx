import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Boxes } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { LanguageSwitcher } from "@/components/language-switcher";
import { logActivity } from "@/lib/activity.functions";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — FlowOps" },
      {
        name: "description",
        content: "Sign in to your FlowOps workspace to manage packing, scanning and returns.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const log = useServerFn(logActivity);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget as HTMLFormElement);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    if (!email || !password) {
      toast.error(t("auth.errors.missingCredentials"));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      toast.error(error.message || t("auth.errors.invalidCredentials"));
      return;
    }
    await log({ data: { action: "user.login", metadata: { email } } }).catch(() => undefined);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">FlowOps</span>
          </Link>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <LanguageSwitcher variant="marketing" />
            <span>
              {t("auth.login.newHere")}{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                {t("auth.login.createWorkspace")}
              </Link>
            </span>
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight">{t("auth.login.title")}</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {t("auth.login.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("auth.login.email")}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue=""
                placeholder={t("auth.login.emailPlaceholder")}
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("auth.login.password")}</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("auth.login.forgot")}
                </button>
              </div>
              <Input id="password" name="password" type="password" defaultValue="" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t("common.signingIn") : t("auth.login.submit")}
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
                  toast.error(res.error.message || "Google sign-in failed");
                }
              }}
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              {t("auth.login.noPublicSignup")}
            </p>
          </form>
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
