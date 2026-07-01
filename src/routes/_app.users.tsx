import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Copy, Link as LinkIcon, MoreHorizontal, UserPlus } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, type AppRole } from "@/lib/use-workspace";
import {
  createReusableInvitationLink as createInvitationLinkFn,
  listReusableInvitationLinks as listInvitationLinksFn,
  removeUser as removeUserFn,
  revokeInvitation as revokeInviteFn,
} from "@/lib/user-management.functions";

export const Route = createFileRoute("/_app/users")({
  head: () => ({
    meta: [
      { title: "Users - FlowOps" },
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

type InvitationLink = Awaited<ReturnType<typeof listInvitationLinksFn>>[number];
type InviteRole = "Packer" | "Return Staff" | "Supervisor";

const LINK_EXPIRATION_OPTIONS = [
  { label: "1 day", days: 1 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

const roleTone = (role: AppRole) =>
  role === "Owner" ? "primary" : role === "Supervisor" ? "info" : role === "Packer" ? "success" : "warning";

const memberStatusTone = (status: Member["status"]) =>
  status === "active" ? "success" : status === "suspended" ? "danger" : "warning";

function invitationStatus(inv: InvitationLink) {
  if (inv.status === "pending" && new Date(inv.expires_at).getTime() < Date.now()) {
    return "expired";
  }
  return inv.status === "revoked" ? "disabled" : inv.status;
}

function invitationStatusTone(status: ReturnType<typeof invitationStatus>) {
  return status === "pending" ? "success" : status === "expired" ? "warning" : "danger";
}

function buildInviteLink(token: string) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/accept-invite?token=${token}`;
}

function UsersPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: ws } = useWorkspace();
  const workspaceId = ws?.workspace?.id;
  const workspaceName = ws?.workspace?.name ?? "FlowOps Workspace";
  const canManageInvites = ws?.role === "Owner" || ws?.role === "Supervisor";
  const isOwner = ws?.role === "Owner";

  const [open, setOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<InviteRole>("Packer");
  const [inviteExpiration, setInviteExpiration] = useState("30");
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");

  const createInvitationLink = useServerFn(createInvitationLinkFn);
  const listInvitationLinks = useServerFn(listInvitationLinksFn);
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

      const ids = members.map((member) => member.user_id);
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email, avatar_color").in("id", ids),
        supabase.from("roles").select("user_id, role").eq("workspace_id", workspaceId!).in("user_id", ids),
      ]);

      return members.map((member) => {
        const profile = profiles?.find((item) => item.id === member.user_id);
        const role = roles?.find((item) => item.user_id === member.user_id);
        return {
          user_id: member.user_id,
          status: member.status,
          joined_at: member.joined_at,
          last_active_at: member.last_active_at,
          role: (role?.role ?? "Packer") as AppRole,
          name: member.full_name ?? profile?.full_name ?? profile?.email?.split("@")[0] ?? "Member",
          email: profile?.email ?? "",
          phone: member.phone,
          avatar_color: profile?.avatar_color ?? "#64748b",
        };
      });
    },
  });

  const invitationLinksQuery = useQuery({
    enabled: !!workspaceId && canManageInvites,
    queryKey: ["invitation-links", workspaceId],
    queryFn: async () => listInvitationLinks({ data: null }),
  });

  const members = membersQuery.data ?? [];
  const invitationLinks = invitationLinksQuery.data ?? [];
  const activeLinks = invitationLinks.filter((link) => invitationStatus(link) === "pending");

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return members;
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        (member.phone ?? "").toLowerCase().includes(query),
    );
  }, [members, search]);

  const copyInviteLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteLink(token));
      toast.success("Invitation link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const createLink = async () => {
    if (!workspaceId) return toast.error(t("users.toast.noWorkspace"));
    if (!canManageInvites) return toast.error("Only Owners and Supervisors can create invitation links.");

    setCreating(true);
    try {
      const link = await createInvitationLink({
        data: {
          role: inviteRole,
          invitationValidDays: parseInt(inviteExpiration, 10),
        },
      });
      await copyInviteLink(link.token);
      toast.success("Invitation link created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["invitation-links", workspaceId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setCreating(false);
    }
  };

  const disableLink = async (id: string) => {
    try {
      await revokeInvite({ data: { invitationId: id } });
      toast.success("Invitation link disabled");
      qc.invalidateQueries({ queryKey: ["invitation-links", workspaceId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    }
  };

  const removeMember = async (userId: string) => {
    if (!confirm(t("users.actions.removeConfirm"))) return;
    try {
      await removeFn({ data: { userId } });
      toast.success(t("users.toast.removed"));
      qc.invalidateQueries({ queryKey: ["members", workspaceId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
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
    toast.success(status === "suspended" ? t("users.toast.deactivated") : t("users.toast.activated"));
    qc.invalidateQueries({ queryKey: ["members", workspaceId] });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users.title")}
        description="Create reusable invitation links and manage workspace members."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" disabled={!canManageInvites}>
                <UserPlus className="h-4 w-4" /> Create invitation link
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create invitation link</DialogTitle>
                <DialogDescription>
                  One link can be used by unlimited users until it expires or is disabled.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-workspace">Workspace</Label>
                  <Input id="invite-workspace" value={workspaceName} disabled />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as InviteRole)}>
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Packer">Packer</SelectItem>
                        <SelectItem value="Return Staff">Return Staff</SelectItem>
                        <SelectItem value="Supervisor">Supervisor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="invite-expiration">Expiration</Label>
                    <Select value={inviteExpiration} onValueChange={setInviteExpiration}>
                      <SelectTrigger id="invite-expiration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LINK_EXPIRATION_OPTIONS.map((option) => (
                          <SelectItem key={option.days} value={String(option.days)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button onClick={createLink} disabled={creating}>
                  {creating ? t("common.sending") : "Create and copy link"}
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
            <span className="text-muted-foreground">/</span>
            <Badge variant="secondary">
              {members.filter((user) => user.status === "active").length} {t("common.active")}
            </Badge>
          </div>
          <Input
            placeholder={t("users.searchPlaceholder")}
            className="h-9 w-64"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
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
            {filteredMembers.map((user) => {
              const initials = user.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2);
              const canActOn = isOwner && user.role !== "Owner";
              return (
                <TableRow key={user.user_id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
                        style={{ background: user.avatar_color }}
                      >
                        {initials}
                      </div>
                      <div>
                        <div className="font-medium">{user.name}</div>
                        <div className="text-xs text-muted-foreground">{user.phone ?? user.email}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={roleTone(user.role)}>{user.role}</StatusPill>
                  </TableCell>
                  <TableCell>
                    <StatusPill tone={memberStatusTone(user.status)}>{user.status}</StatusPill>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.last_active_at ? new Date(user.last_active_at).toLocaleString() : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={!canActOn}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(["Supervisor", "Packer", "Return Staff"] as AppRole[]).map((role) => (
                          <DropdownMenuItem
                            key={role}
                            disabled={user.role === role}
                            onClick={() => changeRole(user.user_id, role)}
                          >
                            {t("users.actions.makeRole", { role })}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuSeparator />
                        {user.status === "active" ? (
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setMemberStatus(user.user_id, "suspended")}
                          >
                            {t("users.actions.deactivate")}
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => setMemberStatus(user.user_id, "active")}>
                            {t("users.actions.activate")}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => removeMember(user.user_id)}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex items-center gap-2 text-sm">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Invitation links</span>
            <span className="text-muted-foreground">/</span>
            <Badge variant="outline">{activeLinks.length} active</Badge>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Workspace</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Expiration</TableHead>
              <TableHead>Joined Users Count</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitationLinks.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {invitationLinksQuery.isLoading ? t("common.loading") : "No invitation links yet."}
                </TableCell>
              </TableRow>
            )}
            {invitationLinks.map((link) => {
              const status = invitationStatus(link);
              const canUse = status === "pending";
              return (
                <TableRow key={link.id}>
                  <TableCell className="font-medium">{workspaceName}</TableCell>
                  <TableCell>
                    <StatusPill tone={roleTone(link.role)}>{link.role}</StatusPill>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(link.expires_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{link.joined_users_count}</TableCell>
                  <TableCell>
                    <StatusPill tone={invitationStatusTone(status)}>{status}</StatusPill>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canUse}
                        onClick={() => copyInviteLink(link.token)}
                        title="Copy Link"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" disabled={!canManageInvites}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem disabled={!canUse} onClick={() => copyInviteLink(link.token)}>
                            <Copy className="mr-2 h-4 w-4" /> Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={!canUse}
                            onClick={() => disableLink(link.id)}
                          >
                            Disable Link
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
