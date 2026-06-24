import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { UserPlus, MoreHorizontal } from "lucide-react";
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
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="User management"
        description="Owner-only. Invite teammates and assign roles for warehouse operations."
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><UserPlus className="h-4 w-4" /> Invite member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a teammate</DialogTitle>
                <DialogDescription>
                  They'll receive an email invitation to join your workspace. No public sign-up is allowed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="invite-email">Work email</Label>
                  <Input id="invite-email" type="email" placeholder="name@company.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="invite-role">Role</Label>
                  <Select defaultValue="Packer">
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
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => setOpen(false)}>Send invite</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="rounded-lg border bg-card shadow-card">
        <div className="flex items-center justify-between border-b p-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-semibold">{users.length}</span>
            <span className="text-muted-foreground">members</span>
            <span className="text-muted-foreground">·</span>
            <Badge variant="secondary">{users.filter(u => u.status === "active").length} active</Badge>
            <Badge variant="outline">{users.filter(u => u.status === "invited").length} pending</Badge>
          </div>
          <Input placeholder="Search members" className="h-9 w-64" />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last active</TableHead>
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
                        <DropdownMenuItem>Change role</DropdownMenuItem>
                        <DropdownMenuItem>Resend invite</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive">
                          Remove from workspace
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
