import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getWs(supabase: any, userId: string) {
  const { data } = await supabase.from("users").select("workspace_id").eq("user_id", userId).maybeSingle();
  return data?.workspace_id as string | null;
}
async function assertOwner(supabase: any, userId: string) {
  const wid = await getWs(supabase, userId);
  if (!wid) throw new Error("No workspace");
  const { data } = await supabase.from("roles").select("role").eq("workspace_id", wid).eq("user_id", userId).maybeSingle();
  if (data?.role !== "Owner") throw new Error("Forbidden");
  return wid;
}

function generateTokenValue(): string {
  // 32 bytes => 256 bits — strong, opaque, prefix lets users identify it later.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return "flo_" + Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export const listApiTokens = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("api_tokens").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as any[];
  });

export const createApiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; scopes?: string[]; expiresInDays?: number }) => d)
  .handler(async ({ data, context }) => {
    const wid = await assertOwner(context.supabase, context.userId);
    const value = generateTokenValue();
    const hash = await sha256(value);
    const expires_at = data.expiresInDays
      ? new Date(Date.now() + data.expiresInDays * 86400_000).toISOString()
      : null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("api_tokens")
      .insert({
        workspace_id: wid,
        name: data.name,
        prefix: value.slice(0, 12),
        token_hash: hash,
        scopes: (data.scopes ?? ["read"]) as never,
        created_by: context.userId,
        expires_at,
      })
      .select("id, prefix")
      .single();
    if (error) throw error;
    // The raw token value is returned ONCE and never stored in plain.
    return { id: row.id, prefix: row.prefix, token: value };
  });

export const revokeApiToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("api_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });
