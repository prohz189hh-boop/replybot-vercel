# ReplyPilot

ReplyPilot is a multi-tenant AI customer-support SaaS built with Next.js, Prisma/Postgres + pgvector, Gemini, Cloudflare R2, and Resend.

## Included

- Email/password authentication, verification and password reset
- Multi-tenant business workspaces with OWNER / ADMIN / AGENT roles
- Five-step onboarding: business → agent → knowledge → test → install
- Agent configuration and RAG playground
- Manual text, FAQ, website and file knowledge sources
- Gemini chat + 1536-dimension embeddings
- Cloudflare R2 storage for production file uploads
- Resend email integration
- Customer conversations, inbox replies, assignment, notes and status
- Analytics, team management, settings and billing/entitlement display
- Platform-admin business overview protected by `PLATFORM_ADMIN`
- Embeddable widget
- Tenant-isolation, RBAC, CORS, rate-limit and visitor-token tests
- Prisma migrations and seed data

## Important production setup

Create environment variables from `.env.example`. Never commit `.env.local` or real credentials.

After adding or rotating `GEMINI_API_KEY` in Vercel, trigger a **new Production deployment** so serverless functions receive the updated value. Then re-index any knowledge source that failed while the AI provider was missing. Confirm `/api/health` returns `{"status":"ready"}`; that endpoint checks the database, not the AI provider, so also send a test message in the agent playground.

Required for a real deployment:

- `DATABASE_URL` — PostgreSQL with pgvector enabled
- `AUTH_SECRET`
- `GEMINI_API_KEY`
- `GEMINI_CHAT_MODEL` — defaults to `gemini-2.5-flash`
- `GEMINI_EMBEDDING_MODEL` — defaults to `gemini-embedding-001`
- `STORAGE_PROVIDER=r2`
- R2 bucket/account/access credentials
- `EMAIL_PROVIDER=resend`
- `EMAIL_API_KEY`
- `EMAIL_FROM`
- Upstash Redis variables for multi-instance production rate limiting

Gemini's current documentation lists `gemini-2.5-flash` as a stable model and `gemini-embedding-001` as a stable text-embedding model. The embedding API supports 1536-dimensional output, matching this project's pgvector column. Re-embed existing knowledge if you ever change embedding models. 

Stripe checkout/subscriptions are intentionally not implemented in this version. The billing page only reflects the application's plan/entitlement state.

## Local commands

```bash
npm install
npx prisma generate
npx prisma migrate dev
npm run typecheck
npm run lint
npm test
npm run build
npm run dev
```

For a fresh Postgres database, make sure the `vector` extension is available before running the migration.

## Deployment

Set the same production environment variables in your hosting provider, run the Prisma migration against the production database, and use the production build:

```bash
npm run build
npm start
```

Do not upload `.env.local` to GitHub or a deployment artifact. Rotate any credential that has accidentally been exposed.
