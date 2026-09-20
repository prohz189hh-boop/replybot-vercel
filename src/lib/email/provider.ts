/**
 * Email abstraction — the rest of the app calls `sendEmail()` only,
 * never a specific vendor SDK, so the provider can change without
 * touching call sites (signup verification, password reset, team
 * invitations, human-handoff notifications).
 */

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string; // always provide a plain-text fallback for deliverability/accessibility
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string } | { skipped: true; reason: string }>;
}

class ResendProvider implements EmailProvider {
  constructor(private apiKey: string, private from: string) {}

  async send(message: EmailMessage) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend API error: ${res.status} ${body}`);
    }

    const data = await res.json();
    return { id: data.id as string };
  }
}

/**
 * Dev fallback: logs instead of sending, so signup/password-reset flows
 * are exercisable (and the token/link visible in server logs for
 * manual testing) without an email provider configured.
 */
class ConsoleEmailProvider implements EmailProvider {
  async send(message: EmailMessage) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[email] Email provider is not configured; message was not sent.");
      return { skipped: true as const, reason: "Email provider is not configured." };
    }
    console.log(`[dev email] to=${message.to} subject="${message.subject}"\n${message.text}`);
    return { skipped: true as const, reason: "No EMAIL_API_KEY configured — logged instead of sent." };
  }
}

let cached: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (cached) return cached;
  const apiKey = process.env.EMAIL_API_KEY;
  const from = process.env.EMAIL_FROM ?? "ReplyPilot <no-reply@replypilot.example>";
  cached = apiKey ? new ResendProvider(apiKey, from) : new ConsoleEmailProvider();
  return cached;
}
