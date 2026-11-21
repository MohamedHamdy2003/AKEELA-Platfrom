# Gmail SMTP

The application sends real OTP emails through Nodemailer SMTP. Mailpit remains isolated local test infrastructure; it is not a production email provider.

## Connect the account

1. Create the sending Google account and enable 2-Step Verification.
2. Create a Google App Password for AKEELA. Use that password, not the Google sign-in password.
3. Edit the ignored `apps/api/.env` locally. Copy the SMTP keys from `apps/api/.env.gmail.example` and fill:

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_REQUIRE_TLS=true
SMTP_USER=your-sending-account@gmail.com
SMTP_PASSWORD=YOUR_GOOGLE_APP_PASSWORD
SMTP_FROM=AKEELA <your-sending-account@gmail.com>
```

Use the same address for SMTP_USER and SMTP_FROM. The application removes spaces from Gmail App Passwords, accepts 16 characters, and requires encrypted SMTP. Never paste actual credentials in chat, commit them, or put them in Bruno.

## Verify and send

Run `npm run smtp:check`. This checks the real SMTP connection and authentication without sending an email. After success, restart the backend and register/verify using your own recipient email in Bruno. Check the inbox/spam folder for the real OTP. Sender login success alone does not prove inbox delivery.

For the compiled Docker runtime, use `npm run smtp:check:prod` inside a container supplied with server-side environment values. Production Compose already passes the SMTP settings; set them on the server, not in the image.

## Operational notes

- Port 465 uses implicit TLS. Alternatively use 587 with SMTP_SECURE=false and SMTP_REQUIRE_TLS=true.
- Missing credentials, a mismatched sender, and invalid Gmail TLS settings fail startup validation. Delivery failures are reported through the existing signup/resend handling and a sanitized server warning; no pretend OTP delivery is returned.
- Google App Password availability depends on the account's security settings. Replacing the Google account password can revoke App Passwords.
- Automated integration tests always override SMTP to local Mailpit, even when `apps/api/.env` uses Gmail. They never send test messages through your real account.

References: [Google App Passwords](https://support.google.com/accounts/answer/185833), [Google SMTP configuration](https://support.google.com/a/answer/176600), [Nodemailer SMTP](https://nodemailer.com/smtp).

## Production verification — 2026-11-18

TLS and Gmail authentication passed from inside the production API container. A different SMTP_USER in the initial production configuration caused a 535 response and was corrected to the owner-approved, locally verified account. App Password and SMTP_USER must belong to the same Google account. No email was sent by the connectivity test; verify real OTP inbox delivery through an intended user flow. Credentials remain private.

## Custom Subdomain & Multi-Provider Automatic Failover (`mail.akeelaonline.tech`)

The API isolates email delivery behind `MailProvider` (`SmtpMailProvider` + `FailoverMailProvider`). Any TLS-encrypted transactional SMTP provider (such as Resend, Brevo, AWS SES, Postmark or Gmail) can be configured in ordered priority without code changes:

- Primary provider: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_REQUIRE_TLS`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` (e.g., `AKEELA <noreply@mail.akeelaonline.tech>`).
- Optional failover providers: `SMTP_FALLBACK_*` and `SMTP_FALLBACK_2_*` through `SMTP_FALLBACK_5_*`. When `SMTP_FALLBACK_FROM` is left blank, the fallback automatically inherits `SMTP_FROM`.
- Automatic failover & cooldown: If the primary provider reaches its daily/monthly quota or hits a transient SMTP/network error, `FailoverMailProvider` immediately sends via the next configured provider and places the failed provider into an in-memory cooldown (60 minutes for quota errors, 15 minutes for transient errors) before probing it again automatically.
- `npm run smtp:check` / `npm run smtp:check:prod` verifies every configured provider in order without sending an email.
- **Production verification — 2026-11-21**: Resend (`smtp.resend.com:465`, primary) and Brevo (`smtp-relay.brevo.com:587`, fallback) both passed live `npm run smtp:check:prod` on the VPS using verified subdomain `mail.akeelaonline.tech` (`AKEELA <noreply@mail.akeelaonline.tech>`), and real Gmail Inbox delivery of the branded RTL HTML + inline CID OTP template was confirmed.
- **Planned future addition**: Add **Amazon SES** (pay-as-you-go) via `SMTP_FALLBACK_2_*` (or primary) once the owner sets up an AWS account and obtains SES Production Access — already supported by `auth.environment.ts` (`inferProviderName` → `ses`) without code changes.
