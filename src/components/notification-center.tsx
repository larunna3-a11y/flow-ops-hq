import { useMemo } from "react";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  clearAll,
} from "@/lib/notifications.functions";
import { useWorkspace } from "@/lib/use-workspace";

const severityDot: Record<string, string> = {
  info: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
};

export function NotificationCenter() {
  const qc = useQueryClient();
  const ws = useWorkspace();
  const list = useServerFn(listNotifications);
  const count = useServerFn(unreadCount);
  const read = useServerFn(markRead);
  const readAll = useServerFn(markAllRead);
  const clear = useServerFn(clearAll);

  const enabled = !!ws.data?.userId;

  const countQ = useQuery({
    queryKey: ["notifications", "unread"],
    enabled,
    queryFn: () => count({}),
    refetchInterval: 30_000,
  });

  const listQ = useQuery({
    queryKey: ["notifications", "list"],
    enabled,
    queryFn: () => list({ data: { limit: 50 } }),
  });

  const items = useMemo(() => listQ.data ?? [], [listQ.data]);
  const unread = countQ.data?.count ?? 0;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unread > 0 && (
              <Badge variant="secondary" className="h-5 text-[10px]">{unread} new</Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm" className="h-7 px-2 text-xs"
              onClick={async () => { await readAll({}); refresh(); }}
              disabled={unread === 0}
            >
              <CheckCheck className="mr-1 h-3.5 w-3.5" /> Mark all
            </Button>
            <Button
              variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"
              onClick={async () => { await clear({}); refresh(); }}
              disabled={items.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <ScrollArea className="max-h-[420px]">
          {items.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-muted-foreground">
              You're all caught up.
            </div>
          ) : (
            <ul className="divide-y">
              {items.map((n: any) => {
                const isUnread = !n.read_at;
                const body = (
                  <div className="flex items-start gap-3 px-4 py-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${severityDot[n.severity] ?? "bg-muted"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm ${isUnread ? "font-semibold text-foreground" : "text-foreground/80"}`}>
                          {n.title}
                        </p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      {n.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>}
                    </div>
                    {isUnread && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault(); e.stopPropagation();
                          await read({ data: { id: n.id } }); refresh();
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted"
                        aria-label="Mark as read"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
                return (
                  <li key={n.id} className={isUnread ? "bg-muted/30" : ""}>
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={async () => { if (isUnread) { await read({ data: { id: n.id } }); refresh(); } }}
                        className="block hover:bg-muted/50"
                      >
                        {body}
                      </Link>
                    ) : body}
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
        <div className="border-t px-4 py-2 text-right">
          <Link to="/automation" className="text-xs text-muted-foreground hover:text-foreground">
            Manage automation →
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
