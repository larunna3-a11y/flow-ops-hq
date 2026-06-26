import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

async function assertOwner(supabase: import("@supabase/supabase-js").SupabaseClient<Database>, userId: string) {
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

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { email: string; role: AppRole; redirectTo: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const workspaceId = await assertOwner(supabase, userId);
    const email = data.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Invalid email address");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Membership check
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingProfile) {
      const { data: existingMember } = await supabaseAdmin
        .from("users")
        .select("user_id, workspace_id")
        .eq("user_id", existingProfile.id)
        .maybeSingle();
      if (existingMember) throw new Error("This user already belongs to a workspace.");
    }

    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    // Upsert invitation row so handle_new_user picks it up on signup.
    const { data: existingInv } = await supabaseAdmin
      .from("invitations")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("email", email)
      .in("status", ["pending"])
      .maybeSingle();

    let invitationId = existingInv?.id ?? null;
    if (invitationId) {
      await supabaseAdmin
        .from("invitations")
        .update({ role: data.role, expires_at: expires, status: "pending", invited_by: userId })
        .eq("id", invitationId);
    } else {
      const { data: inv, error: invErr } = await supabaseAdmin
        .from("invitations")
        .insert({
          workspace_id: workspaceId,
          email,
          role: data.role,
          invited_by: userId,
          expires_at: expires,
          status: "pending",
        })
        .select("id")
        .single();
      if (invErr) throw invErr;
      invitationId = inv.id;
    }

    // Send the Supabase invitation email.
    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: data.redirectTo,
      data: { workspace_id: workspaceId, role: data.role },
    });
    if (mailErr && !/already.*registered|exist/i.test(mailErr.message)) {
      // If user already exists in auth, fall back to a recovery email so they can set a new password.
      const { error: recErr } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: data.redirectTo,
      });
      if (recErr) throw mailErr;
    }

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action: "invitation.sent",
      target_type: "invitation",
      target_id: invitationId,
      metadata: { email, role: data.role } as never,
    });

    return { id: invitationId };
  });

export const resendInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { invitationId: string; redirectTo: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId, supabase } = context;
    const workspaceId = await assertOwner(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inv } = await supabaseAdmin
      .from("invitations")
      .select("id, email, workspace_id")
      .eq("id", data.invitationId)
      .maybeSingle();
    if (!inv || inv.workspace_id !== workspaceId) throw new Error("Invitation not found");

    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdmin
      .from("invitations")
      .update({ status: "pending", expires_at: expires })
      .eq("id", inv.id);

    const { error: mailErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(inv.email, {
      redirectTo: data.redirectTo,
    });
    if (mailErr) {
      await supabaseAdmin.auth.resetPasswordForEmail(inv.email, { redirectTo: data.redirectTo });
    }

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action: "invitation.resent",
      target_type: "invitation",
      target_id: inv.id,
    });
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

    // Don't allow removing other Owners (defensive — workspace should have a single owner).
    const { data: targetRole } = await supabaseAdmin
      .from("roles")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", data.userId)
      .maybeSingle();
    if (targetRole?.role === "Owner") throw new Error("Cannot remove the workspace Owner.");

    await supabaseAdmin.from("roles").delete().eq("workspace_id", workspaceId).eq("user_id", data.userId);
    await supabaseAdmin.from("users").delete().eq("workspace_id", workspaceId).eq("user_id", data.userId);

    await supabaseAdmin.from("audit_logs").insert({
      workspace_id: workspaceId,
      actor_id: userId,
      action: "member.removed",
      target_type: "user",
      target_id: data.userId,
    });
    return { ok: true };
  });
