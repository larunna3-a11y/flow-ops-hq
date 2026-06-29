import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { useWorkspace, useCurrentUser } from "@/lib/use-workspace";
import { canAccess, HOME_PATH, moduleForPath } from "@/lib/permissions";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { data: user, isLoading: userLoading } = useCurrentUser();
  const { data: ws, isLoading } = useWorkspace();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const navigate = useNavigate();
  const role = ws?.role ?? null;

  // 1) Not signed in → bounce to /login.
  useEffect(() => {
    if (userLoading) return;
    if (!user) navigate({ to: "/login", replace: true });
  }, [user, userLoading, navigate]);

  // 2) Signed in but no workspace yet (trigger still running, or membership row
  //    missing). Retry once after a short delay; if still missing, sign out so
  //    the user never gets stuck on "No active workspace".
  useEffect(() => {
    if (userLoading || isLoading) return;
    if (user && !ws) {
      const t = setTimeout(() => {
        // Best-effort: kick the user back to login to retry session/onboarding.
        navigate({ to: "/login", replace: true });
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [user, ws, userLoading, isLoading, navigate]);

  // 3) Role-based route guarding (navigation + deep links).
  useEffect(() => {
    if (isLoading || !role) return;
    const module = moduleForPath(pathname);
    if (module && !canAccess(role, module)) {
      navigate({ to: HOME_PATH[role], replace: true });
    }
  }, [pathname, role, isLoading, navigate]);

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <main className="flex-1 p-4 md:p-6 lg:p-8">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
