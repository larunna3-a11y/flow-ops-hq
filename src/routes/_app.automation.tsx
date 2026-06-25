import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Plus,
  Zap,
  Trash2,
  GripVertical,
  Pencil,
  Check,
  X,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/lib/use-workspace";
import {
  useAutomationRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useReorderRules,
  type AutomationRule,
  type AutomationRuleInput,
  type ConditionField,
  type ConditionOperator,
} from "@/lib/use-automation-rules";
import { MARKETPLACES, COURIERS } from "@/lib/use-orders-data";

export const Route = createFileRoute("/_app/automation")(({
  head: () => ({
    meta: [
      { title: "Automation Rules — FlowOps" },
      {
        name: "description",
        content:
          "Configure barcode detection rules that auto-fill marketplace and courier on every scan.",
      },
    ],
  }),
  component: AutomationPage,
}));

// ─── Constants ────────────────────────────────────────────────────────────────

const CONDITION_FIELDS: { value: ConditionField; label: string }[] = [
  { value: "raw_code", label: "Barcode / QR" },
  { value: "tracking_number", label: "Tracking number" },
  { value: "order_number", label: "Order number" },
];

const CONDITION_OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: "starts_with", label: "starts with" },
  { value: "ends_with", label: "ends with" },
  { value: "contains", label: "contains" },
  { value: "equals", label: "equals" },
  { value: "matches_regex", label: "matches regex" },
];

const EMPTY_FORM: AutomationRuleInput = {
  name: "",
  enabled: true,
  condition_field: "raw_code",
  condition_operator: "starts_with",
  condition_value: "",
  action_marketplace: null,
  action_courier: null,
  sort_order: 0,
};

// ─── Rule form dialog ─────────────────────────────────────────────────────────

interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  initial?: AutomationRule | null;
  nextOrder: number;
}

function RuleFormDialog({ open, onClose, initial, nextOrder }: RuleFormProps) {
  const create = useCreateRule();
  const update = useUpdateRule();
  const [form, setForm] = useState<AutomationRuleInput>(
    initial
      ? {
          name: initial.name,
          enabled: initial.enabled,
          condition_field: initial.condition_field,
          condition_operator: initial.condition_operator,
          condition_value: initial.condition_value,
          action_marketplace: initial.action_marketplace,
          action_courier: initial.action_courier,
          sort_order: initial.sort_order,
        }
      : { ...EMPTY_FORM, sort_order: nextOrder }
  );

  const set = <K extends keyof AutomationRuleInput>(
    key: K,
    value: AutomationRuleInput[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const isPending = create.isPending || update.isPending;

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Rule name is required.");
      return;
    }
    if (!form.condition_value.trim()) {
      toast.error("Condition value is required.");
      return;
    }
    if (!form.action_marketplace && !form.action_courier) {
      toast.error("Set at least one action (marketplace or courier).");
      return;
    }
    try {
      if (initial) {
        await update.mutateAsync({ id: initial.id, ...form });
        toast.success("Rule updated.");
      } else {
        await create.mutateAsync(form);
        toast.success("Rule created.");
      }
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save rule.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit rule" : "New automation rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Rule name</Label>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Shopee SPX orders"
              autoFocus
            />
          </div>

          {/* Condition */}
          <div className="rounded-md border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              IF
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Field</Label>
                <Select
                  value={form.condition_field}
                  onValueChange={(v) => set("condition_field", v as ConditionField)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Operator</Label>
                <Select
                  value={form.condition_operator}
                  onValueChange={(v) =>
                    set("condition_operator", v as ConditionOperator)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPERATORS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Value</Label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={form.condition_value}
                  onChange={(e) => set("condition_value", e.target.value)}
                  placeholder="SPX"
                />
              </div>
            </div>
          </div>

          {/* Action */}
          <div className="rounded-md border bg-muted/40 p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              THEN set
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Marketplace</Label>
                <Select
                  value={form.action_marketplace ?? "__none__"}
                  onValueChange={(v) =>
                    set("action_marketplace", v === "__none__" ? null : v)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="(don't change)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(don't change)</SelectItem>
                    {MARKETPLACES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Courier</Label>
                <Select
                  value={form.action_courier ?? "__none__"}
                  onValueChange={(v) =>
                    set("action_courier", v === "__none__" ? null : v)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="(don't change)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">(don't change)</SelectItem>
                    {COURIERS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="rule-enabled" className="text-sm">
              Rule enabled
            </Label>
            <Switch
              id="rule-enabled"
              checked={form.enabled}
              onCheckedChange={(v) => set("enabled", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving…" : initial ? "Save changes" : "Create rule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rule card ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: AutomationRule;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function RuleCard({
  rule,
  isFirst,
  isLast,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: RuleCardProps) {
  const update = useUpdateRule();

  const toggleEnabled = async () => {
    try {
      await update.mutateAsync({ id: rule.id, enabled: !rule.enabled });
    } catch {
      toast.error("Failed to toggle rule.");
    }
  };

  const operatorLabel =
    CONDITION_OPERATORS.find((o) => o.value === rule.condition_operator)
      ?.label ?? rule.condition_operator;
  const fieldLabel =
    CONDITION_FIELDS.find((f) => f.value === rule.condition_field)?.label ??
    rule.condition_field;

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm transition-opacity ${
        rule.enabled ? "" : "opacity-50"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag handle / reorder buttons */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5">
          <GripVertical className="h-4 w-4 text-muted-foreground/40 mb-1" />
          <button
            onClick={onMoveUp}
            disabled={isFirst}
            className="rounded p-0.5 hover:bg-muted disabled:opacity-20"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast}
            className="rounded p-0.5 hover:bg-muted disabled:opacity-20"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{rule.name}</span>
            {!rule.enabled && (
              <Badge variant="secondary" className="text-xs">
                Disabled
              </Badge>
            )}
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-muted-foreground items-center">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono">
              {fieldLabel}
            </span>
            <span>{operatorLabel}</span>
            <span className="rounded bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-1.5 py-0.5 font-mono font-semibold">
              &quot;{rule.condition_value}&quot;
            </span>
            <span className="text-muted-foreground/60">→</span>
            {rule.action_marketplace && (
              <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5">
                {rule.action_marketplace}
              </span>
            )}
            {rule.action_courier && (
              <span className="rounded bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-1.5 py-0.5">
                {rule.action_courier}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={rule.enabled}
            onCheckedChange={toggleEnabled}
            disabled={update.isPending}
            aria-label="Toggle rule"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function AutomationPage() {
  const { data: ws } = useWorkspace();
  const isOwner = ws?.role === "Owner";
  const { data: rules = [], isLoading } = useAutomationRules();
  const deleteRule = useDeleteRule();
  const reorder = useReorderRules();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(rule: AutomationRule) {
    setEditing(rule);
    setDialogOpen(true);
  }

  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deleteRule.mutateAsync(deletingId);
      toast.success("Rule deleted.");
    } catch {
      toast.error("Failed to delete rule.");
    } finally {
      setDeletingId(null);
    }
  }

  async function moveRule(index: number, direction: "up" | "down") {
    const newRules = [...rules];
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newRules.length) return;
    [newRules[index], newRules[swapIndex]] = [
      newRules[swapIndex],
      newRules[index],
    ];
    await reorder.mutateAsync(newRules.map((r) => r.id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Rules"
        description="Rules are evaluated top-to-bottom on every scan. The first matching rule wins."
        actions={
          isOwner ? (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add rule
            </Button>
          ) : undefined
        }
      />

      {/* Empty state */}
      {!isLoading && rules.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card p-12 text-center">
          <Zap className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium">No rules yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Create your first rule to auto-detect marketplace and courier from
            barcodes.
          </p>
          {isOwner && (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add first rule
            </Button>
          )}
        </div>
      )}

      {/* Example hint banner */}
      {rules.length === 0 && !isLoading && (
        <div className="rounded-md border bg-muted/40 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground">Example rules:</p>
          <p>
            <span className="font-mono bg-muted rounded px-1">raw_code</span>{" "}
            starts_with{" "}
            <span className="font-mono bg-amber-100 dark:bg-amber-900/30 rounded px-1">
              &quot;SPX&quot;
            </span>{" "}
            → Marketplace: <strong>Shopee</strong>, Courier:{" "}
            <strong>SPX Express</strong>
          </p>
          <p>
            <span className="font-mono bg-muted rounded px-1">raw_code</span>{" "}
            starts_with{" "}
            <span className="font-mono bg-amber-100 dark:bg-amber-900/30 rounded px-1">
              &quot;JT&quot;
            </span>{" "}
            → Courier: <strong>J&T Express</strong>
          </p>
          <p>
            <span className="font-mono bg-muted rounded px-1">tracking_number</span>{" "}
            contains{" "}
            <span className="font-mono bg-amber-100 dark:bg-amber-900/30 rounded px-1">
              &quot;LAZADA&quot;
            </span>{" "}
            → Marketplace: <strong>Lazada</strong>
          </p>
        </div>
      )}

      {/* Rule list */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-lg border bg-card animate-pulse"
            />
          ))}
        </div>
      )}

      {!isLoading && rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule, i) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isFirst={i === 0}
              isLast={i === rules.length - 1}
              onEdit={() => openEdit(rule)}
              onDelete={() => setDeletingId(rule.id)}
              onMoveUp={() => moveRule(i, "up")}
              onMoveDown={() => moveRule(i, "down")}
            />
          ))}
        </div>
      )}

      {/* How it works explainer */}
      {rules.length > 0 && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs text-muted-foreground space-y-1">
          <p className="font-medium text-foreground flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-primary" />
            How rules work
          </p>
          <p>
            On each scan, the barcode/QR value is tested against rules in
            order. The first rule that matches automatically fills in the
            marketplace and/or courier — no manual selection needed.
          </p>
          <p>
            Rules that are disabled are skipped. Drag or use the arrows to
            change priority.
          </p>
        </div>
      )}

      {/* Create/Edit dialog */}
      {dialogOpen && (
        <RuleFormDialog
          open={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
          }}
          initial={editing}
          nextOrder={rules.length}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog
        open={!!deletingId}
        onOpenChange={(v) => !v && setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. Scans will no longer be auto-classified by
              this rule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
