import { useNavigate } from "@tanstack/react-router";
import { Bell, Moon, Search, Sun, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useServerFn } from "@tanstack/react-start";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/components/theme-provider";
import { supabase } from "@/integrations/supabase/client";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useQuery } from "@tanstack/react-query";
import { useWorkspace } from "@/lib/use-workspace";
import { logActivity } from "@/lib/activity.functions";

export function AppTopbar() {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const ws = useWorkspace();
  const log = useServerFn(logActivity);

  const profile = useQuery({
    queryKey: ["profile", ws.data?.userId],
    enabled: !!ws.data?.userId,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name, email").eq("id", ws.data!.userId!).maybeSingle();
      return data;
    },
  });

  const name = profile.data?.full_name || profile.data?.email || "Operator";
  const email = profile.data?.email || "";
  const role = ws.data?.role || "Member";
  const initials = name.split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-md">
      <SidebarTrigger className="-ml-1" />
      <div className="relative hidden md:flex flex-1 max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t("topbar.searchPlaceholder")}
          className="pl-9 h-9 bg-muted/50 border-transparent focus-visible:bg-background"
        />
      </div>
      <div className="flex-1 md:hidden" />
      <LanguageSwitcher />
      <Button variant="ghost" size="icon" onClick={toggle} aria-label={t("nav.toggleTheme")}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
      <Button variant="ghost" size="icon" className="relative" aria-label={t("nav.notifications")}>
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-destructive" />
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted transition-colors">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground bg-primary"
            >
              {initials}
            </div>
            <div className="hidden md:block text-left leading-tight">
              <div className="text-sm font-medium">{name}</div>
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-medium">
                {role}
              </Badge>
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="font-medium">{name}</div>
            <div className="text-xs text-muted-foreground font-normal">{email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>{t("topbar.settings")}</DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate({ to: "/users" })}>{t("topbar.team")}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={async () => {
              await log({ data: { action: "user.logout" } }).catch(() => undefined);
              await supabase.auth.signOut();
              navigate({ to: "/" });
            }}
            className="text-destructive focus:text-destructive"
          >
            <LogOut className="mr-2 h-4 w-4" /> {t("topbar.signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
