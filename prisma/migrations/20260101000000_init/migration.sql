-- ReplyPilot baseline migration.
--
-- ⚠️ UNVERIFIED: written by hand against schema.prisma because this
-- environment has no live PostgreSQL instance and no network access to
-- run `prisma migrate dev`. It has NOT been executed against a real
-- database. Before relying on it: run `npx prisma migrate diff
-- --from-empty --to-schema-datamodel prisma/schema.prisma --script`
-- in an environment with Prisma installed and diff it against this
-- file, or simply run `npx prisma migrate dev` fresh and let Prisma
-- regenerate migrations from schema.prisma (the schema is the source
-- of truth; this file is a best-effort hand transcription of it).

-- Required for KnowledgeChunk.embedding (vector(1536)).
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid(), used by raw inserts

-- ── Enums ───────────────────────────────────────────────────────────────

CREATE TYPE "PlatformRole" AS ENUM ('USER', 'PLATFORM_ADMIN');
CREATE TYPE "BusinessRole" AS ENUM ('OWNER', 'ADMIN', 'AGENT');
CREATE TYPE "AgentPersonality" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'CONCISE', 'DETAILED');
CREATE TYPE "ResponseLength" AS ENUM ('SHORT', 'BALANCED', 'DETAILED');
CREATE TYPE "KnowledgeSourceType" AS ENUM ('MANUAL_TEXT', 'FAQ', 'WEBSITE', 'FILE');
CREATE TYPE "KnowledgeSourceStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'AI', 'WAITING_FOR_HUMAN', 'HUMAN', 'RESOLVED');
CREATE TYPE "MessageSender" AS ENUM ('CUSTOMER', 'AI', 'HUMAN', 'SYSTEM');
CREATE TYPE "UnansweredStatus" AS ENUM ('UNANSWERED', 'ANSWERED', 'IGNORED');
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'PRO', 'BUSINESS');

-- ── Identity & tenancy ──────────────────────────────────────────────────

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" TIMESTAMP(3),
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "platformRole" "PlatformRole" NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "User_email_idx" ON "User"("email");

CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

CREATE TABLE "PasswordResetToken" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

CREATE TABLE "EmailVerificationToken" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "tokenHash" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

CREATE TABLE "Business" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "website" TEXT,
  "industry" TEXT,
  "description" TEXT,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "openingHours" JSONB,
  "address" TEXT,
  "supportedLanguages" TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Business_name_idx" ON "Business"("name");

CREATE TABLE "BusinessMember" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "role" "BusinessRole" NOT NULL DEFAULT 'AGENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "BusinessMember_businessId_userId_key" UNIQUE ("businessId", "userId")
);
CREATE INDEX "BusinessMember_businessId_idx" ON "BusinessMember"("businessId");
CREATE INDEX "BusinessMember_userId_idx" ON "BusinessMember"("userId");

CREATE TABLE "TeamInvitation" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "email" TEXT NOT NULL,
  "role" "BusinessRole" NOT NULL DEFAULT 'AGENT',
  "tokenHash" TEXT NOT NULL UNIQUE,
  "invitedById" TEXT NOT NULL REFERENCES "User"("id"),
  "acceptedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "TeamInvitation_businessId_idx" ON "TeamInvitation"("businessId");
CREATE INDEX "TeamInvitation_email_idx" ON "TeamInvitation"("email");

-- ── Agents & knowledge ──────────────────────────────────────────────────

CREATE TABLE "Agent" (
  "id" TEXT PRIMARY KEY,
  "publicId" TEXT NOT NULL UNIQUE,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "name" TEXT NOT NULL,
  "personality" "AgentPersonality" NOT NULL DEFAULT 'FRIENDLY',
  "responseLength" "ResponseLength" NOT NULL DEFAULT 'BALANCED',
  "languages" TEXT[] NOT NULL DEFAULT ARRAY['en']::TEXT[],
  "confidenceThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.55,
  "fallbackMessage" TEXT NOT NULL DEFAULT 'I don''t have enough information to answer that accurately. Would you like me to connect you with a member of the team?',
  "escalationKeywords" TEXT[] NOT NULL DEFAULT ARRAY['human','agent','representative','talk to someone']::TEXT[],
  "allowedDomains" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Agent_businessId_idx" ON "Agent"("businessId");
CREATE INDEX "Agent_publicId_idx" ON "Agent"("publicId");

CREATE TABLE "WidgetConfiguration" (
  "id" TEXT PRIMARY KEY,
  "agentId" TEXT NOT NULL UNIQUE REFERENCES "Agent"("id") ON DELETE CASCADE,
  "logoUrl" TEXT,
  "welcomeMessage" TEXT NOT NULL DEFAULT 'Hi! How can I help you today?',
  "primaryColor" TEXT NOT NULL DEFAULT '#6366F1',
  "position" TEXT NOT NULL DEFAULT 'bottom-right',
  "chatButtonText" TEXT NOT NULL DEFAULT 'Chat with us',
  "theme" TEXT NOT NULL DEFAULT 'auto',
  "avatarUrl" TEXT,
  "humanHandoffMessage" TEXT NOT NULL DEFAULT 'Connecting you with a team member...',
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "KnowledgeSource" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "agentId" TEXT NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
  "type" "KnowledgeSourceType" NOT NULL,
  "name" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "filePath" TEXT,
  "rawContent" TEXT,
  "status" "KnowledgeSourceStatus" NOT NULL DEFAULT 'PROCESSING',
  "errorMessage" TEXT,
  "chunkCount" INTEGER NOT NULL DEFAULT 0,
  "lastIndexedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "KnowledgeSource_businessId_idx" ON "KnowledgeSource"("businessId");
CREATE INDEX "KnowledgeSource_agentId_idx" ON "KnowledgeSource"("agentId");
CREATE INDEX "KnowledgeSource_status_idx" ON "KnowledgeSource"("status");

CREATE TABLE "KnowledgeChunk" (
  "id" TEXT PRIMARY KEY,
  "knowledgeSourceId" TEXT NOT NULL REFERENCES "KnowledgeSource"("id") ON DELETE CASCADE,
  "businessId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "embedding" vector(1536),
  "tokenCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "KnowledgeChunk_knowledgeSourceId_idx" ON "KnowledgeChunk"("knowledgeSourceId");
CREATE INDEX "KnowledgeChunk_businessId_idx" ON "KnowledgeChunk"("businessId");
-- IVFFlat index for approximate nearest-neighbor search, scoped by the
-- businessId filter every query in rag/pipeline.ts applies. Tune `lists`
-- upward as row count grows (rule of thumb: rows/1000, min 1).
CREATE INDEX "KnowledgeChunk_embedding_idx" ON "KnowledgeChunk" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

-- ── Conversations ───────────────────────────────────────────────────────

CREATE TABLE "Customer" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "externalId" TEXT NOT NULL,
  "name" TEXT,
  "email" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  CONSTRAINT "Customer_businessId_externalId_key" UNIQUE ("businessId", "externalId")
);
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");

CREATE TABLE "Conversation" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "agentId" TEXT NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "status" "ConversationStatus" NOT NULL DEFAULT 'AI',
  "assignedToId" TEXT,
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "aiLockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "Conversation_businessId_idx" ON "Conversation"("businessId");
CREATE INDEX "Conversation_businessId_status_idx" ON "Conversation"("businessId", "status");
CREATE INDEX "Conversation_agentId_idx" ON "Conversation"("agentId");
CREATE INDEX "Conversation_customerId_idx" ON "Conversation"("customerId");

CREATE TABLE "Message" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "sender" "MessageSender" NOT NULL,
  "content" TEXT NOT NULL,
  "authorMemberId" TEXT,
  "retrievedChunkIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "confidence" DOUBLE PRECISION,
  "clientMessageId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  -- Postgres treats each NULL as distinct for a UNIQUE constraint, so
  -- AI/HUMAN/SYSTEM messages (clientMessageId IS NULL) never collide
  -- with each other — only two CUSTOMER messages in the same
  -- conversation sharing a real clientMessageId are rejected, which is
  -- exactly the idempotency behavior chat/route.ts relies on.
  CONSTRAINT "Message_conversationId_clientMessageId_key" UNIQUE ("conversationId", "clientMessageId")
);
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

CREATE TABLE "InternalNote" (
  "id" TEXT PRIMARY KEY,
  "conversationId" TEXT NOT NULL REFERENCES "Conversation"("id") ON DELETE CASCADE,
  "authorMemberId" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "InternalNote_conversationId_idx" ON "InternalNote"("conversationId");

CREATE TABLE "UnansweredQuestion" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL,
  "agentId" TEXT NOT NULL REFERENCES "Agent"("id") ON DELETE CASCADE,
  "conversationId" TEXT REFERENCES "Conversation"("id") ON DELETE SET NULL,
  "question" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "UnansweredStatus" NOT NULL DEFAULT 'UNANSWERED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "UnansweredQuestion_businessId_status_idx" ON "UnansweredQuestion"("businessId", "status");
CREATE INDEX "UnansweredQuestion_agentId_idx" ON "UnansweredQuestion"("agentId");

-- ── Billing ─────────────────────────────────────────────────────────────

CREATE TABLE "Subscription" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL UNIQUE REFERENCES "Business"("id") ON DELETE CASCADE,
  "plan" "PlanTier" NOT NULL DEFAULT 'FREE',
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "currentPeriodEnd" TIMESTAMP(3),
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "UsageRecord" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES "Business"("id") ON DELETE CASCADE,
  "metric" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UsageRecord_businessId_metric_period_key" UNIQUE ("businessId", "metric", "period")
);
CREATE INDEX "UsageRecord_businessId_period_idx" ON "UsageRecord"("businessId", "period");

-- ── Audit ───────────────────────────────────────────────────────────────

CREATE TABLE "AuditLog" (
  "id" TEXT PRIMARY KEY,
  "businessId" TEXT REFERENCES "Business"("id") ON DELETE SET NULL,
  "userId" TEXT REFERENCES "User"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "metadata" JSONB,
  "ipAddress" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT now()
);
CREATE INDEX "AuditLog_businessId_idx" ON "AuditLog"("businessId");
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
