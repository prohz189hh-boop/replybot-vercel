import { getEmailProvider } from "@/lib/email/provider";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function wrapHtml(title: string, bodyHtml: string, ctaText: string, ctaUrl: string): string {
  // Minimal inline-styled HTML — email clients don't reliably support
  // external stylesheets or Tailwind classes, so this stays plain.
  return `
    <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:480px;margin:0 auto;padding:32px 20px;color:#14171F">
      <p style="font-weight:700;font-size:16px;margin:0 0 24px">ReplyPilot</p>
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      <div style="font-size:14px;line-height:1.6;color:#3A3D45">${bodyHtml}</div>
      <a href="${ctaUrl}" style="display:inline-block;margin-top:20px;background:#3E5CE8;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600">${ctaText}</a>
      <p style="margin-top:24px;font-size:12px;color:#8A8D94">If the button doesn't work, copy this link: ${ctaUrl}</p>
    </div>
  `;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${APP_URL}/verify-email?token=${encodeURIComponent(token)}`;
  return getEmailProvider().send({
    to,
    subject: "Verify your ReplyPilot email",
    html: wrapHtml(
      "Verify your email",
      "<p>Confirm your email address to finish setting up your ReplyPilot account.</p>",
      "Verify email",
      url,
    ),
    text: `Verify your ReplyPilot email: ${url}`,
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${APP_URL}/reset-password?token=${encodeURIComponent(token)}`;
  return getEmailProvider().send({
    to,
    subject: "Reset your ReplyPilot password",
    html: wrapHtml(
      "Reset your password",
      "<p>We got a request to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>",
      "Reset password",
      url,
    ),
    text: `Reset your ReplyPilot password: ${url} (expires in 1 hour)`,
  });
}

export async function sendTeamInvitationEmail(to: string, token: string, businessName: string, inviterName: string) {
  const url = `${APP_URL}/invitations/${encodeURIComponent(token)}`;
  return getEmailProvider().send({
    to,
    subject: `${inviterName} invited you to ${businessName} on ReplyPilot`,
    html: wrapHtml(
      `Join ${businessName} on ReplyPilot`,
      `<p>${inviterName} invited you to join <strong>${businessName}</strong>'s support team on ReplyPilot.</p>`,
      "Accept invitation",
      url,
    ),
    text: `${inviterName} invited you to join ${businessName} on ReplyPilot: ${url}`,
  });
}

export async function sendHumanHandoffNotificationEmail(to: string, businessName: string, conversationUrl: string) {
  return getEmailProvider().send({
    to,
    subject: `A conversation needs you — ${businessName}`,
    html: wrapHtml(
      "A conversation needs a human",
      `<p>Your AI agent escalated a conversation it couldn't confidently answer.</p>`,
      "Open conversation",
      conversationUrl,
    ),
    text: `A conversation needs you: ${conversationUrl}`,
  });
}
