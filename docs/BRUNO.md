# Bruno API Collection

The Git-managed collection lives at `bruno/AKEELA`. It contains the 12 implemented Feature 01 requests under `01 - Authentication and My Profile`. New implemented features get the same numbered folder names as the API specifications; do not add runnable placeholders for unimplemented endpoints.

## Main-branch testing copy

Use a separate checkout so testing follows released `main` while development continues on feature branches:

```sh
git clone --branch main --single-branch https://github.com/MohamedHamdy2003/AKEELA-Platfrom.git AKEELA-Bruno
```

In Bruno, choose **Open Collection** and select `AKEELA-Bruno/bruno/AKEELA`. The prepared local testing checkout is `G:\AKEELA-Bruno`. Pull updates from main using Bruno's Git controls or `git pull --ff-only origin main` in that checkout. Changes are Git-synchronized by pulling, not streamed automatically from GitHub.

## Private values and test flow

1. Copy the collection's `.env.example` to `.env` in that same collection folder. This is separate from the backend `.env`.
2. Fill API_EMAIL, API_PASSWORD, API_PHONE, and API_FULL_NAME. New passwords need 8–128 characters, including a letter and a digit. Gmail SMTP credentials belong only in backend `.env`.
3. Select **Local** for `http://localhost:3000/api/v1`. Production reads API_BASE_URL from the private collection `.env`; set the actual HTTPS API URL including `/api/v1` after deployment.
4. Run customer registration or restaurant registration with a new email/phone. Then set VERIFICATION_OTP from the received email and run Verify email.
5. Run Login. It saves access_token and refresh_token as runtime variables; protected requests inherit Bearer auth. Refresh rotates both runtime values.
6. Use Get me / Update me. For password recovery, run Forgot password, set RESET_OTP, then Reset password. For password change/reset, fill API_NEW_PASSWORD and update API_PASSWORD afterward.

Run requests individually. A full collection run is not a signup-to-delivery scenario: OTP entry is manual, customer/restaurant signup are alternatives, and Logout/Reset/Change password revoke sessions. Tests show expected success statuses; intended validation/activation errors will fail those success assertions.

Tokens are held in memory and cleared after successful logout or password reset/change. Restarting Bruno loses runtime tokens; log in again. Never save tokens, OTPs, or real passwords into tracked .bru files or screenshots/reports intended for GitHub.

## Future agent handoff

- Update the endpoint specifications and matching feature folder in the same feature PR.
- Run `npm run bruno:check` and `npm run docs:check`. The first discovers numbered feature folders and validates their syntax, request bodies, scripts, auth modes, and route coverage against the matching specification section.
- Keep one collection, two shared environment templates, private `.env` values, and runtime tokens. Avoid new tooling layers or generated endpoint placeholders.
- Feature PRs target dev. Publishing newer collections to main follows the owner-approved release flow; this Auth/Bruno promotion is explicitly approved, not blanket permission for future main merges.
- Main shows released APIs. To test an unreleased feature before promotion, open the collection from that feature checkout instead of changing the main testing copy.

References: [Bruno Git collaboration](https://docs.usebruno.com/git-integration/overview), [private dotenv files](https://docs.usebruno.com/secrets-management/dotenv-file), [runtime variables](https://docs.usebruno.com/variables/runtime-variables).
