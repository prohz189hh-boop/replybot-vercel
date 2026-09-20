# ReplyPilot: first Vercel deployment

## Current verification status

- `npm install` could not finish in the preparation environment (timed out). Therefore the app has **not** passed an actual dependency install, typecheck, test suite, or production build here.
- `prisma/migrations/20260101000000_init/migration.sql` is hand-written and explicitly marked **unverified**. Validate it against the Prisma schema and a disposable fresh Postgres database **before** applying it to your actual Supabase database. Do not run it on an existing database without a backup and review.
- This ZIP has no `.env.local` or production secrets.
- Stripe payment processing is not implemented; do not accept live subscriptions using this version.

## Setup

1. Upload the **contents of the `replypilot` directory** to a private GitHub repository. The repository root should contain `package.json` and `prisma/` (not an extra nested `replypilot/` folder). Never upload `.env.local`.
2. In Vercel, select **Add New > Project**, import the repository, and choose the Next.js framework. The build script is `prisma generate && next build` and the install command is the normal `npm install`.
3. Configure production environment variables using `.env.example`. Set the full production `NEXT_PUBLIC_APP_URL` once Vercel assigns the URL (https://...). Do not copy example placeholders into production. Set `DATABASE_URL`, `AUTH_SECRET`, Gemini variables, R2 variables, Resend variables, and Upstash variables. Avoid setting billing/Stripe secrets when not using Stripe.
4. On a safe **disposable database**, verify the migration. Only when it checks out, apply schema changes to your intended database using `npm run db:deploy` in a trusted environment with the appropriate database credentials. Production migration should be controlled separately from every Vercel build.
5. Deploy a preview, inspect the build logs, and test account signup/email verification, onboarding, retrieval, widget chat, team roles, file uploads and human handoff. Only promote to production after these tests succeed.

Security: never paste database URLs, API keys, passwords, or other secrets into chat or GitHub. Rotate any credentials already exposed.
