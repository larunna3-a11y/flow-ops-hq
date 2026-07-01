import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace, type AppRole } from "@/lib/use-workspace";
import {
  useInvitationLinks,
  createInvitationLink,
  disableInvitationLink,
  getExpiryCountdown,
  copyInvitationLink,
  type InvitationLink,
} from "@/lib/invitation-links";
import { toast } from "sonner";
import { Copy, MoreVertical, XCircle, Loader2, Link as LinkIcon } from "lucide-react";

export const Route = createFileRoute("/_app/invitations")({
  head: () => ({
    meta: [
      { title: "Invitation Links — FlowOps" },
      { name: "description", content: "Create and manage invitation links for your workspace." },
    ],
  }),
  component: InvitationsPage,
});

function InvitationsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: ws } = useWorkspace();
  const workspaceId = ws?.workspace?.id;
  const isManager = ws?.role === "Owner" || ws?.role === "Supervisor";

  const linksQuery = useInvitationLinks();
  const links = linksQuery.data ?? [];

  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<AppRole>("Packer");
  const [expiryDays, setExpiryDays] = useState("30");
  const [creating, setCreating] = useState(false);

  const [disableTarget, setDisableTarget] = useState<InvitationLink | null>(null);
  const [disabling, setDisabling] = useState(false);

  const roles: AppRole[] = ["Packer", "Return Staff", "Supervisor"];

  const handleCreateLink = async () => {
    if (!workspaceId) return;
    setCreating(true);
    try {
      await createInvitationLink({
        workspaceId,
        role: selectedRole,
        expiryDays: parseInt(expiryDays),
      });
      toast.success(`Invitation link created for ${selectedRole}s (expires in ${expiryDays} days)`);
      setCreateOpen(false);
      setSelectedRole("Packer");
      setExpiryDays("30");
      qc.invalidateQueries({ queryKey: ["invitation_links"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  };

  const handleDisableLink = async () => {
    if (!disableTarget) return;
    setDisabling(true);
    try {
      await disableInvitationLink(disableTarget.id);
      toast.success("Invitation link disabled");
      setDisableTarget(null);
      qc.invalidateQueries({ queryKey: ["invitation_links"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to disable link");
    } finally {
      setDisabling(false);
    }
  };

  const handleCopyLink = async (linkId: string) => {
    try {
      await copyInvitationLink(linkId);
      toast.success("Link copied to clipboard");
    } catch (e) {
      toast.error("Failed to copy link");
    }
  };

  const activeLinks = links.filter((l) => l.status === "active" && new Date(l.expires_at) > new Date());
  const disabledLinks = links.filter((l) => l.status === "disabled" || new Date(l.expires_at) <= new Date());

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invitation Links"
        description="Create and manage reusable invitation links for team members."
        actions={
          isManager && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <LinkIcon className="h-4 w-4" /> Create Link
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Invitation Link</DialogTitle>
                  <DialogDescription>
                    Generate a reusable link for team members to join your workspace.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Role</label>
                    <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as AppRole)}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      All users joining via this link will be assigned this role.
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Expires In</label>
                    <Select value={expiryDays} onValueChange={setExpiryDays}>
                      <SelectTrigger className="mt-1.5">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Link will automatically expire after this period.
                    </p>
                  </div>

                  <div className="rounded-md bg-muted p-3">
                    <p className="text-xs text-muted-foreground">
                      ✓ One link can be used by unlimited users<br />
                      ✓ Users only enter their Full Name<br />
                      ✓ No email or password setup required<br />
                      ✓ Automatically assigned to workspace and role
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateLink} disabled={creating}>
                    {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Create Link
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )
        }
      />

      {/* Active Links */}
      {activeLinks.length > 0 && (
        <div className="rounded-lg border bg-card shadow-card overflow-hidden">
          <div className="border-b bg-muted/30 px-6 py-3">
            <h3 className="text-sm font-semibold">Active Links ({activeLinks.length})</h3>
            <p className="text-xs text-muted-foreground">Ready to share with new team members</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead>Recent Users</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead className="text-right w-20">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeLinks.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <Badge variant="outline">{link.role}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">{link.used_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {link.used_by_names.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {link.used_by_names.slice(-2).map((name, i) => (
                          <div key={i}>{name}</div>
                        ))}
                        {link.used_by_names.length > 2 && (
                          <div className="text-[10px] italic">+{link.used_by_names.length - 2} more</div>
                        )}
                      </div>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="text-success">{getExpiryCountdown(link.expires_at)}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{link.created_by_name}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7">
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleCopyLink(link.id)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDisableTarget(link)}
                          className="text-destructive"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-2" />
                          Disable Link
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Disabled/Expired Links */}
      {disabledLinks.length > 0 && (
        <div className="rounded-lg border bg-card shadow-card overflow-hidden opacity-60">
          <div className="border-b bg-muted/30 px-6 py-3">
            <h3 className="text-sm font-semibold">Inactive Links ({disabledLinks.length})</h3>
            <p className="text-xs text-muted-foreground">Disabled or expired</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Role</TableHead>
                <TableHead className="text-right">Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created By</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {disabledLinks.map((link) => (
                <TableRow key={link.id}>
                  <TableCell>
                    <Badge variant="outline" className="opacity-50">
                      {link.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{link.used_count}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="opacity-50">
                      {link.status === "disabled"
                        ? "Disabled"
                        : new Date(link.expires_at) <= new Date()
                          ? "Expired"
                          : "—"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{link.created_by_name}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {links.length === 0 && (
        <div className="rounded-lg border border-dashed bg-card p-8 text-center">
          <LinkIcon className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">No invitation links yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create your first link to start inviting team members</p>
        </div>
      )}

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={!!disableTarget} onOpenChange={(open) => !open && setDisableTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable this invitation link?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This link will no longer work for new sign-ups. Anyone who already has this link won't be able to
                  use it.
                </p>
                <p className="font-medium text-foreground">
                  Used by {disableTarget?.used_count || 0} user{(disableTarget?.used_count || 0) !== 1 ? "s" : ""}
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={disabling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={disabling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDisableLink}
            >
              {disabling && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Disable Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
