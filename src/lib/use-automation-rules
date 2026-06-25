import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWorkspace } from "@/lib/use-workspace";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConditionField = "raw_code" | "tracking_number" | "order_number";
export type ConditionOperator =
  | "starts_with"
  | "ends_with"
  | "contains"
  | "equals"
  | "matches_regex";

export interface AutomationRule {
  id: string;
  workspace_id: string;
  name: string;
  enabled: boolean;
  condition_field: ConditionField;
  condition_operator: ConditionOperator;
  condition_value: string;
  action_marketplace: string | null;
  action_courier: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface AutomationRuleInput {
  name: string;
  enabled: boolean;
  condition_field: ConditionField;
  condition_operator: ConditionOperator;
  condition_value: string;
  action_marketplace: string | null;
  action_courier: string | null;
  sort_order: number;
}

// ─── Evaluator (runs client-side on each scan) ────────────────────────────────

export interface ScanPayload {
  raw_code: string;
  tracking_number: string;
  order_number: string;
}

export interface RuleMatch {
  rule: AutomationRule;
  marketplace: string | null;
  courier: string | null;
}

function testCondition(
  operator: ConditionOperator,
  value: string,
  input: string
): boolean {
  const lower = input.toLowerCase();
  const val = value.toLowerCase();
  switch (operator) {
    case "starts_with":
      return lower.startsWith(val);
    case "ends_with":
      return lower.endsWith(val);
    case "contains":
      return lower.includes(val);
    case "equals":
      return lower === val;
    case "matches_regex": {
      try {
        return new RegExp(value, "i").test(input);
      } catch {
        return false;
      }
    }
  }
}

/**
 * Evaluate a list of rules against a scan payload.
 * Returns the first matching rule or null.
 */
export function evaluateRules(
  rules: AutomationRule[],
  payload: ScanPayload
): RuleMatch | null {
  const enabled = rules
    .filter((r) => r.enabled)
    .sort((a, b) => a.sort_order - b.sort_order);

  for (const rule of enabled) {
    const input = payload[rule.condition_field] ?? "";
    if (testCondition(rule.condition_operator, rule.condition_value, input)) {
      return {
        rule,
        marketplace: rule.action_marketplace,
        courier: rule.action_courier,
      };
    }
  }
  return null;
}

// ─── React Query hooks ────────────────────────────────────────────────────────

const QK = (workspaceId: string) => ["automation_rules", workspaceId];

export function useAutomationRules() {
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;

  return useQuery({
    queryKey: QK(workspaceId ?? ""),
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AutomationRule[];
    },
  });
}

export function useCreateRule() {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;

  return useMutation({
    mutationFn: async (input: AutomationRuleInput) => {
      if (!workspaceId) throw new Error("No workspace");
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({ ...input, workspace_id: workspaceId })
        .select("*")
        .single();
      if (error) throw error;
      return data as AutomationRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK(workspaceId ?? "") }),
  });
}

export function useUpdateRule() {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;

  return useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<AutomationRuleInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("automation_rules")
        .update(input)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as AutomationRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK(workspaceId ?? "") }),
  });
}

export function useDeleteRule() {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK(workspaceId ?? "") }),
  });
}

export function useReorderRules() {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from("automation_rules")
          .update({ sort_order: index })
          .eq("id", id)
      );
      await Promise.all(updates);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK(workspaceId ?? "") }),
  });
}

// ─── Workspace Preferences hook ───────────────────────────────────────────────

export interface NotificationPrefs {
  scanMismatch: boolean;
  slaBreach: boolean;
  dailySummary: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  scanMismatch: true,
  slaBreach: true,
  dailySummary: false,
};

export function useWorkspacePreferences() {
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;

  return useQuery({
    queryKey: ["workspace_preferences", workspaceId],
    enabled: !!workspaceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_preferences")
        .select("notifications")
        .eq("workspace_id", workspaceId!)
        .maybeSingle();
      if (error) throw error;
      return {
        notifications: {
          ...DEFAULT_PREFS,
          ...(data?.notifications as Partial<NotificationPrefs> ?? {}),
        } as NotificationPrefs,
      };
    },
  });
}

export function useSaveNotificationPrefs() {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const workspaceId = ws.data?.workspace?.id;

  return useMutation({
    mutationFn: async (prefs: NotificationPrefs) => {
      if (!workspaceId) throw new Error("No workspace");
      const { error } = await supabase
        .from("workspace_preferences")
        .upsert({ workspace_id: workspaceId, notifications: prefs as never })
        .eq("workspace_id", workspaceId);
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["workspace_preferences", workspaceId] }),
  });
}
