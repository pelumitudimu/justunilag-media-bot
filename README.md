# JustUNILAG Media Bot — starter project

This is the first working backend for the JustUNILAG Media registration bot. It:
- assigns sequential IDs such as `NIGERIA 001`;
- recognises repeat phone numbers and keeps their original ID;
- stores the WhatsApp number, profile name (if supplied), and timestamps;
- sends a welcome/repeat-visitor reply to inbound text messages;
- provides a password-protected member dashboard and CSV export.

## Important account note

This project uses Meta's **official WhatsApp Cloud API**. It does not automate or control the regular WhatsApp app or WhatsApp Web. A phone number must be onboarded to the WhatsApp Business Platform and meet Meta's current eligibility and migration requirements. Do not delete, migrate, or disconnect your second WhatsApp account until you have checked the current Meta onboarding flow and backed up anything important.

## Run locally

Requires Node.js 20+.

1. Copy `.env.example` to `.env`.
2. Set a unique `ADMIN_PASSWORD` of at least 12 characters.
3. Install no packages — this starter uses Node's built-in modules.
4. Run `npm start`.
5. Visit `http://localhost:3000/health`.
6. Visit `http://localhost:3000/admin` and sign in with the admin credentials.

The local server cannot receive Meta webhooks until it is exposed through a secure public HTTPS URL.

## Meta webhook configuration

After the number is properly onboarded to the WhatsApp Cloud API:

- Set the webhook callback URL to `https://YOUR_DOMAIN/webhook`.
- Set the Verify Token to the exact `VERIFY_TOKEN` in `.env`.
- Subscribe the WhatsApp Business Account webhook to the `messages` field.
- Set `WHATSAPP_TOKEN`, `PHONE_NUMBER_ID`, and `WHATSAPP_API_VERSION` in the hosting environment.
- Keep tokens and passwords private. Never paste them into a public repository or chat.

The app handles inbound text messages only. It does not send marketing broadcasts, scrape groups, or message people who have not contacted the number. Replies should follow Meta's current messaging-window and template rules.

## Storage and next production steps

For this starter, member records are stored in `data/members.json`. Back up this file securely. Before production use, add a persistent database (for example PostgreSQL), webhook signature validation using the Meta app secret, rate limiting, robust event de-duplication, logging/monitoring, HTTPS hosting, and a documented privacy/consent notice. Protect exports because they contain personal phone numbers.

## Test the ID logic

You can test registration without WhatsApp by sending a POST webhook payload only after you have configured a local test harness, or by calling `getOrCreateMember` from a small Node test. Do not expose a public unauthenticated test-registration endpoint.
