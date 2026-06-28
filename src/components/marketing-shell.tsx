import { Link } from "@tanstack/react-router";
import { Boxes, Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";

export function MarketingShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();

  const navLinks = [
    { label: t("nav.home"), to: "/" as const },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
              <Boxes className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">FlowOps</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                activeProps={{ className: "text-foreground" }}
                inactiveProps={{ className: "text-muted-foreground" }}
                activeOptions={{ exact: true }}
                className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            <LanguageSwitcher variant="marketing" />
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">{t("nav.login")}</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/signup">{t("nav.getStarted")}</Link>
            </Button>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <LanguageSwitcher variant="marketing" />
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border"
              aria-label={t("nav.toggleMenu")}
            >
              {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className={cn("border-t border-border/60 md:hidden", open ? "block" : "hidden")}>
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-1 px-4 py-3">
            {navLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
              <Button asChild variant="outline" size="sm">
                <Link to="/login" onClick={() => setOpen(false)}>{t("nav.login")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/signup" onClick={() => setOpen(false)}>{t("nav.getStarted")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border/60 bg-muted/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-1">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-elegant">
                  <Boxes className="h-4 w-4" />
                </div>
                <span className="text-base font-semibold tracking-tight">FlowOps</span>
              </Link>
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">
                {t("footer.tagline")}
              </p>
            </div>

            <FooterCol
              title={t("footer.product")}
              links={[
                { label: t("nav.login"), to: "/login" },
                { label: t("nav.getStarted"), to: "/signup" },
              ]}
            />
            <FooterCol
              title={t("footer.solutions")}
              links={[
                { label: t("footer.ecommerceBrands"), to: "/" },
                { label: t("footer.marketplaceSellers"), to: "/" },
                { label: t("footer.warehouseTeams"), to: "/" },
              ]}
            />
            <FooterCol
              title={t("footer.company")}
              links={[
                { label: t("footer.about"), to: "/" },
                { label: t("footer.contact"), to: "/" },
                { label: t("footer.privacy"), to: "/" },
              ]}
            />
          </div>
          <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <span>{t("footer.rights", { year: new Date().getFullYear() })}</span>
            <span>{t("footer.builtFor")}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: { label: string; to: string }[];
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              to={l.to}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
