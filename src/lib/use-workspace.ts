import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
}

export function useWorkspace() {
  return useQuery({
    queryKey: ["current-workspace"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data: membership } = await supabase
        .from("users")
        .select("workspace_id")
        .eq("user_id", auth.user.id)
        .maybeSingle();
      if (!membership) return null;
      const { data: ws } = await supabase
        .from("workspaces")
        .select("*")
        .eq("id", membership.workspace_id)
        .maybeSingle();
      const { data: role } = await supabase
        .from("roles")
        .select("role")
        .eq("workspace_id", membership.workspace_id)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return { workspace: ws, role: (role?.role ?? null) as AppRole | null, userId: auth.user.id };
    },
  });
}
