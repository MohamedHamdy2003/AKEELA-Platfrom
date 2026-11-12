# Gmail SMTP

The application sends real OTP emails through Nodemailer SMTP. Mailpit remains isolated local test infrastructure; it is not a production email provider.

## Connect the account

1. Create the sending Google account and enable 2-Step Verification.
2. Create a Google App Password for AKEELA. Use that password, not the Google sign-in password.
3. Edit the ignored root `.env` locally. Copy the SMTP keys from `.env.gmail.example` and fill:

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
- Automated integration tests always override SMTP to local Mailpit, even when root `.env` uses Gmail. They never send test messages through your real account.

References: [Google App Passwords](https://support.google.com/accounts/answer/185833), [Google SMTP configuration](https://support.google.com/a/answer/176600), [Nodemailer SMTP](https://nodemailer.com/smtp).
