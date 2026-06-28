/**
 * Email template registry. Provider integration is intentionally not
 * implemented yet — these templates exist so scheduled reports, invitations,
 * password resets and system alerts can be wired up later without changing
 * the calling code.
 */
export type EmailTemplateKey =
  | "user.invitation"
  | "user.password_reset"
  | "report.scheduled"
  | "system.alert";

export type EmailTemplate = {
  key: EmailTemplateKey;
  subject: (vars: Record<string, string>) => string;
  html: (vars: Record<string, string>) => string;
  text: (vars: Record<string, string>) => string;
};

const wrap = (title: string, body: string) => `<!doctype html>
<html><body style="font-family:system-ui,sans-serif;background:#f8fafc;margin:0;padding:24px;">
  <table style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e2e8f0;">
    <tr><td>
      <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a;">${title}</h1>
      <div style="color:#334155;line-height:1.5;font-size:14px;">${body}</div>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <div style="color:#94a3b8;font-size:12px;">FlowOps — warehouse operations</div>
    </td></tr>
  </table>
</body></html>`;

export const emailTemplates: Record<EmailTemplateKey, EmailTemplate> = {
  "user.invitation": {
    key: "user.invitation",
    subject: (v) => `You've been invited to ${v.workspace ?? "FlowOps"}`,
    text: (v) => `Hi ${v.name ?? "there"},\n\n${v.inviter ?? "An admin"} invited you to ${v.workspace ?? "the workspace"} as ${v.role ?? "Member"}.\nAccept: ${v.link ?? ""}`,
    html: (v) => wrap("You've been invited",
      `<p>Hi ${v.name ?? "there"},</p><p><b>${v.inviter ?? "An admin"}</b> invited you to join <b>${v.workspace ?? "the workspace"}</b> as <b>${v.role ?? "Member"}</b>.</p><p><a href="${v.link ?? "#"}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Accept invitation</a></p>`),
  },
  "user.password_reset": {
    key: "user.password_reset",
    subject: () => "Reset your FlowOps password",
    text: (v) => `Reset your password: ${v.link ?? ""}\nThis link expires in 1 hour.`,
    html: (v) => wrap("Reset your password",
      `<p>Click the button below to choose a new password. The link expires in 1 hour.</p><p><a href="${v.link ?? "#"}" style="background:#0f172a;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;">Reset password</a></p>`),
  },
  "report.scheduled": {
    key: "report.scheduled",
    subject: (v) => `Your ${v.frequency ?? "scheduled"} ${v.report_type ?? ""} report`,
    text: (v) => `Your ${v.frequency} ${v.report_type} report is attached.\nGenerated: ${v.generated_at}`,
    html: (v) => wrap(`${v.frequency ?? "Scheduled"} ${v.report_type ?? ""} report`,
      `<p>Your ${v.frequency} ${v.report_type} report is attached.</p><p>Generated at ${v.generated_at}.</p>`),
  },
  "system.alert": {
    key: "system.alert",
    subject: (v) => `FlowOps alert: ${v.title ?? "system update"}`,
    text: (v) => `${v.title}\n\n${v.body}`,
    html: (v) => wrap(v.title ?? "System alert", `<p>${v.body ?? ""}</p>`),
  },
};

export function renderEmail(key: EmailTemplateKey, vars: Record<string, string>) {
  const t = emailTemplates[key];
  return { subject: t.subject(vars), html: t.html(vars), text: t.text(vars) };
}
