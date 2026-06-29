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

function normalisePhone(raw: string): string {
  return raw.replace(/[^0-9+]/g, "");
}

/**
 * Single-phone invitation (kept for backward compatibility). Prefer
 * createBulkPhoneInvitations for the new bulk-paste flow.
 */
export const createPhoneInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      fullName?: string | null;
      phone: string;
      role: AppRole;
      accountExpiresInDays: number | null;
      invitationValidDays?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const workspaceId = await assertOwner(supabase, userId);

    const fullName = (data.fullName ?? "").trim() || null;
    const phone = normalisePhone(data.phone);
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

/**
 * Bulk invitation: accepts one or many phone numbers (one per line in the UI)
 * with a shared role and account expiration. Returns one invitation per phone.
 */
export const createBulkPhoneInvitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      phones: string[];
      role: AppRole;
      accountExpiresInDays: number | null;
      invitationValidDays?: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const workspaceId = await assertOwner(supabase, userId);

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

    // Deduplicate input.
    const seen = new Set<string>();
    const phones = data.phones
      .map((p) => normalisePhone(p))
      .filter((p) => p && p.replace(/\D/g, "").length >= 7)
      .filter((p) => {
        if (seen.has(p)) return false;
        seen.add(p);
        return true;
      });

    if (phones.length === 0) throw new Error("No valid phone numbers were provided.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("invitations")
      .select("phone")
      .eq("workspace_id", workspaceId)
      .eq("status", "pending")
      .in("phone", phones);
    const skip = new Set((existing ?? []).map((r) => r.phone as string));
    const toInsert = phones.filter((p) => !skip.has(p));

    const results: Array<{
      id: string;
      token: string;
      phone: string;
      role: AppRole;
      expires_at: string;
      account_expires_at: string | null;
    }> = [];

    if (toInsert.length > 0) {
      const { data: rows, error } = await supabaseAdmin
        .from("invitations")
        .insert(
          toInsert.map((phone) => ({
            workspace_id: workspaceId,
            email: null,
            full_name: null,
            phone,
            role: data.role,
            invited_by: userId,
            expires_at: inviteExpires,
            status: "pending",
            account_expires_at: accountExpires,
          })) as never,
        )
        .select("id, token, phone, role, expires_at, account_expires_at");
      if (error) throw error;
      results.push(...((rows ?? []) as typeof results));

      await supabaseAdmin.from("audit_logs").insert({
        workspace_id: workspaceId,
        actor_id: userId,
        action: "invitation.bulk_created",
        target_type: "invitation",
        target_id: null,
        metadata: { count: results.length, role: data.role } as never,
      });
    }

    return {
      created: results,
      skipped: Array.from(skip),
    };
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

/**
 * Passwordless invitation acceptance: the invitee submits only a full name.
 * We provision an auth user with a synthetic email + random password (never
 * exposed to the user) and return one-time sign-in credentials so the client
 * can establish a session immediately.
 *
 * Single-use: re-using a token after acceptance fails because the invitation
 * row moves to `accepted` (the handle_new_user trigger does this).
 */
export const acceptInvitation = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; fullName: string }) => data)
  .handler(async ({ data }) => {
    const token = String(data.token || "").trim();
    const fullName = String(data.fullName || "").trim();
    if (!token) throw new Error("Missing invitation token.");
    if (fullName.length < 2) throw new Error("Please enter your full name.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("id, workspace_id, role, status, expires_at, phone")
      .eq("token", token)
      .maybeSingle();
    if (!inv) throw new Error("This invitation link is invalid.");
    if (inv.status !== "pending")
      throw new Error("This invitation has already been used or revoked.");
    if (new Date(inv.expires_at as unknown as string).getTime() < Date.now())
      throw new Error("This invitation has expired. Please request a new one.");

    // Update invitation full_name so handle_new_user uses the invitee's name.
    await supabaseAdmin
      .from("invitations")
      .update({ full_name: fullName })
      .eq("id", inv.id);

    // Synthetic credentials — opaque to the user; never displayed.
    const syntheticEmail = `inv-${token.slice(0, 24).toLowerCase()}@invite.flowops.local`;
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const password =
      "Fl!" +
      Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("") +
      "Z9";

    const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        invitation_token: token,
      },
    });
    if (createErr) {
      // Token may have already been consumed — surface a friendly error.
      throw new Error(createErr.message || "Could not create your account.");
    }

    return {
      email: syntheticEmail,
      password,
      role: inv.role as AppRole,
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
