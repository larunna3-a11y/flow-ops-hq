import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus, MoreHorizontal, Mail, Copy, MessageCircle, Link as LinkIcon, Download, Files } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, type AppRole } from "@/lib/use-workspace";
import {
  createBulkPhoneInvitations as createBulkFn,
  revokeInvitation as revokeInviteFn,
  removeUser as removeUserFn,
} from "@/lib/user-management.functions";

export const Route = createFileRoute("/_app/users")({
  head: () => ({
    meta: [
      { title: "Users — FlowOps" },
      { name: "description", content: "Invite and manage workspace members and roles." },
    ],
  }),
  component: UsersPage,
});

type Member = {
  user_id: string;
  status: "active" | "invited" | "suspended";
  joined_at: string;
  last_active_at: string | null;
  role: AppRole;
  name: string;
  email: string;
  phone: string | null;
  avatar_color: string;
};

type Invitation = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  role: AppRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  token: string;
  created_at: string;
  expires_at: string;
  account_expires_at: string | null;
};

type InviteRole = "Packer" | "Return Staff" | "Supervisor";

const EXPIRATION_OPTIONS: { label: string; days: number | null }[] = [
  { label: "1 Day", days: 1 },
  { label: "7 Days", days: 7 },
  { label: "30 Days", days: 30 },
  { label: "90 Days", days: 90 },
  { label: "Permanent", days: null },
];

const roleTone = (r: AppRole) =>
  r === "Owner" ? "primary" : r === "Supervisor" ? "info" : r === "Packer" ? "success" : "warning";

const memberStatusTone = (s: Member["status"]) =>
  s === "active" ? "success" : s === "suspended" ? "danger" : "warning";

function inviteEffectiveStatus(inv: Invitation): Invitation["status"] {
  if (inv.status === "pending" && new Date(inv.expires_at).getTime() < Date.now()) return "expired";
  return inv.status;
}

const inviteStatusTone = (s: Invitation["status"]) =>
  s === "pending" ? "warning" : s === "accepted" ? "success" : "danger";

function buildInviteLink(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/accept-invite?token=${token}`;
}

function buildWaMessage(opts: {
  workspaceName: string;
  fullName: string;
  role: string;
  link: string;
  expiresAt: string;
}) {
  const expiresDate = new Date(opts.expiresAt).toLocaleDateString();
  return [
    `Hi ${opts.fullName},`,
    ``,
    `You've been invited to join *${opts.workspaceName}* on FlowOps as *${opts.role}*.`,
    ``,
    `Accept your invitation here:`,
    opts.link,
    ``,
    `This link expires on ${expiresDate}.`,
  ].join("\n");
}

function buildWaUrl(phone: string, message: string) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function UsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: ws } = useWorkspace();
  const workspaceId = ws?.workspace?.id;
  const workspaceName = ws?.workspace?.name ?? "FlowOps Workspace";
  const isOwner = ws?.role === "Owner";

  const [open, setOpen] = useState(false);
  const [bulkPhones, setBulkPhones] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("Packer");
  const [inviteExpiration, setInviteExpiration] = useState<string>("30");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");
  const [lastBatch, setLastBatch] = useState<{ token: string; phone: string; role: AppRole }[]>([]);

  const createBulk = useServerFn(createBulkFn);
  const revokeInvite = useServerFn(revokeInviteFn);
  const removeFn = useServerFn(removeUserFn);

  const membersQuery = useQuery({
    enabled: !!workspaceId,
    queryKey: ["members", workspaceId],
    queryFn: async (): Promise<Member[]> => {
      const { data: members } = await supabase
        .from("users")
        .select("user_id, status, joined_at, last_active_at, workspace_id, phone, full_name")
        .eq("workspace_id", workspaceId!);
      if (!members?.length) return [];
      const ids = members.map((m) => m.user_id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_color").in("id", ids),
        supabase.from("roles").select("user_id, role").eq("workspace_id", workspaceId!).in("user_id", ids),
      ]);
      return members.map((m) => {
        const p = profiles?.find((x) => x.id === m.user_id);
        const r = roles?.find((x) => x.user_id === m.user_id);
        return {
          user_id: m.user_id,
          status: m.status,
          joined_at: m.joined_at,
          last_active_at: m.last_active_at,
          role: (r?.role ?? "Packer") as AppRole,
          name: (m as any).full_name ?? p?.full_name ?? p?.email?.split("@")[0] ?? "Member",
          email: p?.email ?? "",
          phone: (m as any).phone ?? null,
          avatar_color: p?.avatar_color ?? "#64748b",
        };
      });
    },
  });

  const invitationsQuery = useQuery({
    enabled: !!workspaceId,
    queryKey: ["invitations", workspaceId],
    queryFn: async (): Promise<Invitation[]> => {
      const { data } = await supabase
        .from("invitations")
        .select(
          "id, full_name, phone, email, role, status, token, created_at, expires_at, account_expires_at",
        )
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      return (data ?? []) as Invitation[];
    },
  });

  const members = membersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const pendingInvitations = invitations.filter(
    (i) => inviteEffectiveStatus(i) === "pending",
  );

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone ?? "").toLowerCase().includes(q),
    );
  }, [members, search]);

  const parsedPhones = useMemo(
    () =>
      bulkPhones
        .split(/[\n,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [bulkPhones],
  );

  const sendInvite = async () => {
    if (!workspaceId) return toast.error(t("users.toast.noWorkspace"));
    if (!isOwner) return toast.error(t("users.toast.ownerOnly"));
    if (parsedPhones.length === 0) return toast.error("Paste at least one phone number");

    const accountExpiresInDays =
      inviteExpiration === "permanent" ? null : parseInt(inviteExpiration, 10);

    setSending(true);
    try {
      const res = await createBulk({
        data: {
          phones: parsedPhones,
          role: inviteRole,
          accountExpiresInDays,
        },
      });
      const created = res.created ?? [];
      if (created.length === 0) {
        toast.message("No new invitations created", {
          description: "All phone numbers already have pending invitations.",
        });
      } else {
        setLastBatch(created.map((c) => ({ token: c.token, phone: c.phone, role: c.role })));
        const allLinks = created.map((c) => buildInviteLink(c.token)).join("\n");
        try {
          await navigator.clipboard.writeText(allLinks);
          toast.success(`${created.length} invitation${created.length === 1 ? "" : "s"} created — all links copied`);
        } catch {
          toast.success(`${created.length} invitation${created.length === 1 ? "" : "s"} created`);
        }
        if (res.skipped?.length) {
          toast.message(`${res.skipped.length} already had a pending invitation`, {
            description: res.skipped.join(", "),
          });
        }
      }
      setBulkPhones("");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["invitations", workspaceId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await revokeInvite({ data: { invitationId: id } });
      toast.success(t("users.toast.revoked"));
      qc.invalidateQueries({ queryKey: ["invitations", workspaceId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const copyInviteLink = async (inv: Invitation) => {
    const link = buildInviteLink(inv.token);
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invitation link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const shareViaWhatsApp = (inv: Invitation) => {
    if (!inv.phone) return toast.error("Invitation has no phone number");
    const message = buildWaMessage({
      workspaceName,
      fullName: inv.full_name ?? "there",
      role: inv.role,
      link: buildInviteLink(inv.token),
      expiresAt: inv.expires_at,
    });
    window.open(buildWaUrl(inv.phone, message), "_blank", "noopener,noreferrer");
  };

  const removeMember = async (userId: string) => {
    if (!confirm(t("users.actions.removeConfirm"))) return;
    try {
      await removeFn({ data: { userId } });
      toast.success(t("users.toast.removed"));
      qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const changeRole = async (userId: string, role: AppRole) => {
    if (!workspaceId) return;
    const { error } = await supabase
      .from("roles")
      .update({ role })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success(t("users.toast.roleChanged"));
    qc.invalidateQueries({ queryKey: ["members", workspaceId] });
  };

  const setMemberStatus = async (userId: string, status: Member["status"]) => {
    if (!workspaceId) return;
    const { error } = await supabase
      .from("users")
      .update({ status })
      .eq("workspace_id", workspaceId)
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    toast.success(
      status === "suspended" ? t("users.toast.deactivated") : t("users.toast.activated"),
    );
    qc.invalidateQueries({ queryKey: ["members", workspaceId] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!isOwner}>
                <UserPlus className="h-4 w-4" /> {t("users.invite")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite team members</DialogTitle>
                <DialogDescription>
                  Paste one or many phone numbers (one per line). We'll generate a secure,
                  single-use invitation link for each — invitees only need to enter their full
                  name to join.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-phones">Phone Numbers</Label>
                  <Textarea
                    id="invite-phones"
                    rows={6}
                    placeholder={"+6281234567890\n+6289876543210\n+6285555111222"}
                    value={bulkPhones}
                    onChange={(e) => setBulkPhones(e.target.value)}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    {parsedPhones.length} number{parsedPhones.length === 1 ? "" : "s"} detected ·
                    one per line, comma, or semicolon
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as InviteRole)}>
                      <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Packer">Packer</SelectItem>
                        <SelectItem value="Return Staff">Return Staff</SelectItem>
                        <SelectItem value="Supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-expiration">Account Expiration</Label>
                    <Select value={inviteExpiration} onValueChange={setInviteExpiration}>
                      <SelectTrigger id="invite-expiration"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {EXPIRATION_OPTIONS.map((o) => (
                          <SelectItem key={o.label} value={o.days == null ? "permanent" : String(o.days)}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={sendInvite} disabled={sending || parsedPhones.length === 0}>
                  {sending ? t("common.sending") : `Create ${parsedPhones.length || ""} invitation${parsedPhones.length === 1 ? "" : "s"}`.trim()}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold">{members.length}</span>
            <span className="text-muted-foreground">{t("common.members")}</span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="secondary">{members.filter((u) => u.status === "active").length} {t("common.active")}</Badge>
            <Badge variant="outline">{pendingInvitations.length} {t("common.pending")}</Badge>
          </div>
          <Input
            placeholder={t("users.searchPlaceholder")}
            className="h-9 w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("users.columns.member")}</TableHead>
              <TableHead>{t("users.columns.role")}</TableHead>
              <TableHead>{t("users.columns.status")}</TableHead>
              <TableHead>{t("users.columns.lastActive")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {membersQuery.isLoading ? t("common.loading") : t("users.empty")}
                </TableCell>
              </TableRow>
            )}
            {filteredMembers.map((u) => {
              const initials = u.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
              const canActOn = isOwner && u.role !== "Owner";
              return (
                <TableRow key={u.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
                        style={{ background: u.avatar_color }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium">{u.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {u.phone ?? u.email}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell><StatusPill tone={roleTone(u.role)}>{u.role}</StatusPill></TableCell>
                  <TableCell><StatusPill tone={memberStatusTone(u.status)}>{u.status}</StatusPill></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {u.last_active_at ? new Date(u.last_active_at).toLocaleString() : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!canActOn}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(["Supervisor", "Packer", "Return Staff"] as AppRole[]).map((r) => (
                          <DropdownMenuItem
                            key={r}
                            disabled={u.role === r}
                            onClick={() => changeRole(u.user_id, r)}
                          >
                            {t("users.actions.makeRole", { role: r })}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        {u.status === "active" ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setMemberStatus(u.user_id, "suspended")}
                          >
                            {t("users.actions.deactivate")}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setMemberStatus(u.user_id, "active")}>
                            {t("users.actions.activate")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => removeMember(u.user_id)}
                        >
                          {t("users.actions.remove")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">{t("users.invitations.title")}</span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="outline">{pendingInvitations.length} {t("common.pending")}</Badge>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>{t("users.columns.role")}</TableHead>
              <TableHead>{t("users.columns.status")}</TableHead>
              <TableHead>{t("users.invitations.columns.expires")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {invitationsQuery.isLoading ? t("common.loading") : t("users.invitations.empty")}
                </TableCell>
              </TableRow>
            )}
            {invitations.map((inv) => {
              const effective = inviteEffectiveStatus(inv);
              const canShare = effective === "pending";
              return (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.full_name ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inv.phone ?? inv.email ?? "—"}</TableCell>
                  <TableCell><StatusPill tone={roleTone(inv.role)}>{inv.role}</StatusPill></TableCell>
                  <TableCell><StatusPill tone={inviteStatusTone(effective)}>{effective}</StatusPill></TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(inv.expires_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canShare}
                        onClick={() => copyInviteLink(inv)}
                        title="Copy invitation link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canShare || !inv.phone}
                        onClick={() => shareViaWhatsApp(inv)}
                        title="Send via WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={!isOwner}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            disabled={!canShare}
                            onClick={() => copyInviteLink(inv)}
                          >
                            <LinkIcon className="mr-2 h-4 w-4" /> Copy invitation link
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!canShare || !inv.phone}
                            onClick={() => shareViaWhatsApp(inv)}
                          >
                            <MessageCircle className="mr-2 h-4 w-4" /> Send via WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={effective !== "pending"}
                            onClick={() => handleRevoke(inv.id)}
                          >
                            {t("users.actions.revoke")}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
