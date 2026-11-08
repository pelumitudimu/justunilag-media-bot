# JustUNILAG Media — WhatsApp registration bot (Vercel version)

This repository contains a Vercel serverless version of the JustUNILAG Media WhatsApp registration bot. It is a **setup-ready codebase, not a live bot**. It is not connected to Meta, Vercel, or a database yet.

## How registration works
- A person sends **JOIN** (or **REGISTER**) to the WhatsApp number.
- Only then does the bot store their number as a member.
- It assigns an ID such as `NIGERIA 001`.
- The same phone number keeps its original ID on later JOIN messages.
- Duplicate Meta webhook events are ignored.
- The admin page is protected with HTTP Basic Authentication and can export a CSV.

A normal incoming message does not automatically enrol someone. Registration requires the person to send JOIN/REGISTER.

## Hosting and database
- Hosting: Vercel Node.js Functions.
- Database: Supabase Postgres.
- Member records are not stored in the Vercel filesystem.
- Database setup is in `supabase/schema.sql`.

Supabase Free projects can pause after a week of inactivity. Check current plan limits and account eligibility before creating a project.

## Setup checklist
1. Create a Supabase project using an eligible account holder.
2. In Supabase SQL Editor, run the complete contents of `supabase/schema.sql`.
3. Copy the project URL and server-side service-role/secret key. Keep the key private.
4. Import this GitHub repository into Vercel and deploy.
5. In Vercel Project Settings → Environment Variables, add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VERIFY_TOKEN` — a long random value you create privately
   - `META_APP_SECRET`
   - `WHATSAPP_TOKEN`
   - `PHONE_NUMBER_ID`
   - `WHATSAPP_API_VERSION` (optional; defaults to `v23.0`)
   - `ADMIN_USER`
   - `ADMIN_PASSWORD` — use a unique password of at least 16 characters
6. Redeploy after adding or changing environment variables.
7. Meta webhook callback URL: `https://YOUR-VERCEL-DOMAIN/api/webhook`. Enter the same private verification token in Meta and subscribe the WhatsApp Business Account to the `messages` field.
8. Test with a separate test number before considering any migration of the dedicated number.

## Routes
- `GET /api/health` — health check.
- `GET /api/webhook` — Meta webhook verification.
- `POST /api/webhook` — signed Meta webhook events.
- `/admin` — private dashboard.
- `GET /api/admin/members` — authenticated member list.
- `GET /api/admin/export` — authenticated CSV export.

## Security and privacy
- Never commit environment variables, access tokens, database keys, passwords, or member data.
- The Supabase service-role key bypasses Row Level Security. It belongs only in Vercel server-side environment variables, never in browser code.
- The database enables Row Level Security and revokes access for public client roles.
- Webhook POST requests are checked with Meta's `X-Hub-Signature-256` using `META_APP_SECRET`.
- Member phone numbers are personal information. Publish a short privacy notice before inviting people to register, collect only what is needed, restrict dashboard access, and establish a retention/deletion process.
- Registration is not permission for promotional broadcasts. Message only people who explicitly opted in, and follow Meta's current messaging-window and template rules.
- Do not migrate or disconnect the existing WhatsApp account until Meta's current onboarding requirements are checked and a backup is made.

## Important
This code still needs a full end-to-end test in the actual Vercel, Supabase, and Meta environments before it is used with real members. Do not invite people to register yet.