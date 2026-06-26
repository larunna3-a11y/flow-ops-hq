import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { UserPlus, MoreHorizontal, Mail } from "lucide-react";
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
  avatar_color: string;
};

type Invitation = {
  id: string;
  email: string;
  role: AppRole;
  status: "pending" | "accepted" | "revoked" | "expired";
  created_at: string;
  expires_at: string;
};

const roleTone = (r: AppRole) =>
  r === "Owner" ? "primary" : r === "Supervisor" ? "info" : r === "Packer" ? "success" : "warning";

const memberStatusTone = (s: Member["status"]) =>
  s === "active" ? "success" : s === "suspended" ? "danger" : "warning";

const inviteStatusTone = (s: Invitation["status"]) =>
  s === "pending" ? "warning" : s === "accepted" ? "success" : "danger";

function UsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: ws } = useWorkspace();
  const workspaceId = ws?.workspace?.id;
  const isOwner = ws?.role === "Owner";

  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("Packer");
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState("");

  const membersQuery = useQuery({
    enabled: !!workspaceId,
    queryKey: ["members", workspaceId],
    queryFn: async (): Promise<Member[]> => {
      const { data: members } = await supabase
        .from("users")
        .select("user_id, status, joined_at, last_active_at, workspace_id")
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
          name: p?.full_name ?? p?.email?.split("@")[0] ?? "Member",
          email: p?.email ?? "",
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
        .select("id, email, role, status, created_at, expires_at")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const members = membersQuery.data ?? [];
  const invitations = invitationsQuery.data ?? [];
  const pendingInvitations = invitations.filter((i) => i.status === "pending");

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q),
    );
  }, [members, search]);

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return toast.error(t("users.toast.missingEmail"));
    if (!workspaceId) return toast.error(t("users.toast.noWorkspace"));
    if (!isOwner) return toast.error(t("users.toast.ownerOnly"));
    if (members.some((m) => m.email.toLowerCase() === email))
      return toast.error(t("users.toast.alreadyMember"));
    if (pendingInvitations.some((i) => i.email.toLowerCase() === email))
      return toast.error(t("users.toast.alreadyInvited"));

    setSending(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase.from("invitations").insert({
      workspace_id: workspaceId,
      email,
      role: inviteRole,
      invited_by: auth.user?.id ?? null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success(t("users.toast.sent", { email }));
    setInviteEmail("");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["invitations", workspaceId] });
  };

  const revokeInvitation = async (id: string) => {
    const { error } = await supabase.from("invitations").update({ status: "revoked" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(t("users.toast.revoked"));
    qc.invalidateQueries({ queryKey: ["invitations", workspaceId] });
  };

  const resendInvitation = async (inv: Invitation) => {
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error } = await supabase
      .from("invitations")
      .update({ status: "pending", expires_at: expires })
      .eq("id", inv.id);
    if (error) return toast.error(error.message);
    toast.success(t("users.toast.resent", { email: inv.email }));
    qc.invalidateQueries({ queryKey: ["invitations", workspaceId] });
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

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success(t("users.toast.resetSent", { email }));
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
                <DialogTitle>{t("users.dialog.title")}</DialogTitle>
                <DialogDescription>{t("users.dialog.description")}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">{t("users.dialog.email")}</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder={t("users.dialog.emailPlaceholder")}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">{t("users.dialog.role")}</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as AppRole)}>
                    <SelectTrigger id="invite-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Supervisor">Supervisor</SelectItem>
                      <SelectItem value="Packer">Packer</SelectItem>
                      <SelectItem value="Return Staff">Return Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={sendInvite} disabled={sending}>
                  {sending ? t("common.sending") : t("users.dialog.send")}
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
                        <div className="text-xs text-muted-foreground">{u.email}</div>
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
                        <DropdownMenuItem onClick={() => resetPassword(u.email)}>
                          {t("users.actions.resetPassword")}
                        </DropdownMenuItem>
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
              <TableHead>{t("users.invitations.columns.email")}</TableHead>
              <TableHead>{t("users.columns.role")}</TableHead>
              <TableHead>{t("users.columns.status")}</TableHead>
              <TableHead>{t("users.invitations.columns.expires")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {invitationsQuery.isLoading ? t("common.loading") : t("users.invitations.empty")}
                </TableCell>
              </TableRow>
            )}
            {invitations.map((inv) => (
              <TableRow key={inv.id}>
                <TableCell className="font-medium">{inv.email}</TableCell>
                <TableCell><StatusPill tone={roleTone(inv.role)}>{inv.role}</StatusPill></TableCell>
                <TableCell><StatusPill tone={inviteStatusTone(inv.status)}>{inv.status}</StatusPill></TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(inv.expires_at).toLocaleDateString()}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={!isOwner}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={inv.status === "accepted"}
                        onClick={() => resendInvitation(inv)}
                      >
                        {t("users.actions.resend")}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={inv.status !== "pending"}
                        onClick={() => revokeInvitation(inv.id)}
                      >
                        {t("users.actions.revoke")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
