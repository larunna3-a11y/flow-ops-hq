import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/page-header";
import { StatusPill, statusToTone } from "@/components/status-pill";
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
import { users, type Role } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/users")({
  head: () => ({
    meta: [{ title: "Users — FlowOps" }, { name: "description", content: "Invite and manage workspace members and roles." }],
  }),
  component: UsersPage,
});

const roleTone = (r: Role) =>
  r === "Owner" ? "primary" : r === "Supervisor" ? "info" : r === "Packer" ? "success" : "warning";

function UsersPage() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("Packer");
  const [sending, setSending] = useState(false);

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) {
      toast.error(t("users.toast.missingEmail"));
      return;
    }
    setSending(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setSending(false);
      toast.error(t("users.toast.mustSignIn"));
      return;
    }
    const { data: membership } = await supabase
      .from("users")
      .select("workspace_id")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!membership) {
      setSending(false);
      toast.error(t("users.toast.noWorkspace"));
      return;
    }
    const { error } = await supabase.from("invitations").insert({
      workspace_id: membership.workspace_id,
      email,
      role: inviteRole,
      invited_by: auth.user.id,
    });
    setSending(false);
    if (error) {
      toast.error(error.message || t("users.toast.ownerOnly"));
      return;
    }
    toast.success(t("users.toast.sent", { email }));
    setInviteEmail("");
    setOpen(false);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("users.title")}
        description={t("users.description")}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4" /> {t("users.invite")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("users.dialog.title")}</DialogTitle>
                <DialogDescription>
                  {t("users.dialog.description")}
                </DialogDescription>
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
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
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
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{users.length}</span>
            <span className="text-muted-foreground">{t("common.members")}</span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="secondary">{users.filter(u => u.status === "active").length} {t("common.active")}</Badge>
            <Badge variant="outline">{users.filter(u => u.status === "invited").length} {t("common.pending")}</Badge>
          </div>
          <Input placeholder={t("users.searchPlaceholder")} className="h-9 w-64" />
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
            {users.map((u) => {
              const initials = u.name.split(" ").map((p) => p[0]).join("").slice(0, 2);
              return (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground"
                        style={{ background: u.avatarColor }}
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
                  <TableCell><StatusPill tone={statusToTone(u.status)}>{u.status}</StatusPill></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.lastActive}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={u.role === "Owner"}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>{t("users.actions.changeRole")}</DropdownMenuItem>
                        <DropdownMenuItem>{t("users.actions.resend")}</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
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
    </div>
  );
}
