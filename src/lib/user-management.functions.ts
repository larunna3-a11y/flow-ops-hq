import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

async function assertOwner(
  supabase: import("@supabase/supabase-js").SupabaseClient<Database>,
  userId: string,
) {
  const { data: u } = await supabase
    .from("users")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!u) throw new Error("No workspace membership");
  const { data: r } = await supabase
    .from("roles")
    .select("role")
    .eq("workspace_id", u.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (r?.role !== "Owner") throw new Error("Only the workspace Owner can perform this action.");
  return u.workspace_id;
}

/**
 * Phone-first invitation: creates a pending invitation row carrying full name,
 * phone, role and (optional) account expiration. Returns the invitation token
 * so the Owner can copy the link or share it via WhatsApp.
 */
export const createPhoneInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      fullName: string;
      phone: string;
      role: AppRole;
      // Number of days the invitee's account stays active after acceptance.
      // `null` means permanent.
      accountExpiresInDays: number | null;
      // Number of days the invitation link itself stays valid before expiring.
      invitationValidDays?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const workspaceId = await assertOwner(supabase, userId);

    const fullName = data.fullName.trim();
    const phone = data.phone.replace(/[^0-9+]/g, "");
    if (!fullName) throw new Error("Full name is required");
    if (!phone || phone.replace(/\D/g, "").length < 7) throw new Error("Invalid phone number");
    if (!["Packer", "Return Staff", "Supervisor"].includes(data.role))
      throw new Error("Invalid role");

    const linkValidDays = data.invitationValidDays ?? 14;
    const inviteExpires = new Date(
      Date.now() + linkValidDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const accountExpires =
      data.accountExpiresInDays == null
        ? null
        : new Date(Date.now() + data.accountExpiresInDays * 24 * 60 * 60 * 1000).toISOString();

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Prevent duplicate pending invitations to the same phone.
    const { data: existing } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("phone", phone)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) throw new Error("There is already a pending invitation for this phone number.");

    const { data: inv, error } = await supabaseAdmin
      .from("invitations")
      .insert({
        workspace_id: workspaceId,
        email: null,
        full_name: fullName,
        phone,
        role: data.role,
        invited_by: userId,
        expires_at: inviteExpires,
        status: "pending",
        account_expires_at: accountExpires,
      } as never)
      .select("id, token, expires_at, account_expires_at, full_name, phone, role")
      .single();
    if (error) throw error;

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action: "invitation.created",
      target_type: "invitation",
      target_id: inv.id,
      metadata: { full_name: fullName, phone, role: data.role } as never,
    });

    return inv;
  });

/** Public lookup of a pending invitation by its secret token (used by /accept-invite). */
export const getInvitationByToken = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    if (!data.token || data.token.length < 16) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("id, full_name, phone, role, status, expires_at, account_expires_at, workspace_id")
      .eq("token", data.token)
      .maybeSingle();
    if (!inv) return null;
    const { data: ws } = await supabaseAdmin
      .from("workspaces")
      .select("name")
      .eq("id", inv.workspace_id)
      .maybeSingle();
    return {
      id: inv.id,
      full_name: inv.full_name,
      phone: inv.phone,
      role: inv.role,
      status: inv.status,
      expires_at: inv.expires_at,
      account_expires_at: inv.account_expires_at,
      workspace_name: ws?.name ?? "FlowOps Workspace",
    };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invitationId: string }) => data)
  .handler(async ({ data, context }) => {
    const workspaceId = await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitationId)
      .eq("workspace_id", workspaceId);
    if (error) throw error;
    return { ok: true };
  });

export const removeUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const workspaceId = await assertOwner(supabase, userId);
    if (data.userId === userId) throw new Error("You cannot remove yourself.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: targetRole } = await supabaseAdmin
      .from("roles")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (targetRole?.role === "Owner") throw new Error("Cannot remove the workspace Owner.");

    await supabaseAdmin
      .from("roles")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.userId);
    await supabaseAdmin
      .from("users")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.userId);

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action: "member.removed",
      target_type: "user",
      target_id: data.userId,
    });
    return { ok: true };
  });
