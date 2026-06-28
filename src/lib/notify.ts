import { createNotification } from "@/lib/notifications.functions";

export type NotificationType =
  | "order.imported"
  | "user.invited"
  | "packing.assigned"
  | "scan.duplicate"
  | "return.created"
  | "return.completed"
  | "import.failed"
  | "scan.failed"
  | "export.completed"
  | "system.update"
  | "report.scheduled";

export type NotifyOpts = {
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
  severity?: "info" | "success" | "warning" | "error";
  metadata?: Record<string, unknown>;
  userIds?: string[];
  roles?: ("Owner" | "Supervisor" | "Packer" | "Return Staff")[];
};

/** Fire-and-forget — never throws, never blocks the caller. */
export async function notify(opts: NotifyOpts) {
  try {
    await createNotification({ data: opts });
  } catch {
    /* notifications must not break primary flow */
  }
}
