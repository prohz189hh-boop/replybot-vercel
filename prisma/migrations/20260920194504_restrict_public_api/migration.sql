-- Keep ReplyPilot's Prisma-managed tables inaccessible via Supabase's public API.
-- The app connects using its private server-side PostgreSQL connection,
-- and does not authorize anonymous or Supabase Auth clients to query these tables.
-- A separate Supabase migration with these grants has already been applied to the
-- project's initial database. REVOKE is safe and idempotent on a new database.
REVOKE ALL PRIVILEGES ON TABLE public."User" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Session" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."PasswordResetToken" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."EmailVerificationToken" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Business" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."BusinessMember" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."TeamInvitation" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Agent" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."WidgetConfiguration" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."KnowledgeSource" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."KnowledgeChunk" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Customer" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Conversation" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Message" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."InternalNote" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."UnansweredQuestion" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."Subscription" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."UsageRecord" FROM anon, authenticated;
REVOKE ALL PRIVILEGES ON TABLE public."AuditLog" FROM anon, authenticated;
