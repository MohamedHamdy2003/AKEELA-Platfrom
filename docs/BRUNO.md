# Bruno API Collection

The Git-managed collection lives at `bruno/AKEELA`. It contains 89 implemented requests across folders 01-16. New implemented features get the same numbered folder names as the API specifications; do not add runnable placeholders for unimplemented endpoints.

## Open the project collection

Use the collection inside the backend repository. In Bruno, choose **Open Collection** and select:

```text
G:\AKEELA\bruno\AKEELA
```

The collection follows the current branch of the same repository as the backend. Update requests with their feature, then use the normal feature branch → dev → owner-approved main flow. Do not create a separate testing checkout. GitHub updates arrive through Git pulls, not automatically in Bruno.

## Private values and test flow

1. Copy the collection's `.env.example` to `.env` in that same collection folder. This is separate from the backend `apps/api/.env`.
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
- Test the current feature using this same project collection; its requests follow the checked-out branch.

References: [Bruno Git collaboration](https://docs.usebruno.com/git-integration/overview), [private dotenv files](https://docs.usebruno.com/secrets-management/dotenv-file), [runtime variables](https://docs.usebruno.com/variables/runtime-variables).

## Cart and customer orders

Folders 11 and 12 contain the ten implemented cart/order requests. Use Customer login. Set runtime rest_id/prod_id from the public menu. Add item stores cart_item_id and Checkout stores order_id in runtime variables only. Quote is informational; checkout uses current prices plus EGP 30.00 without a quote token or checkout key. The templates show a one-time address; replace it with address_id to use a saved address. Run requests individually, not the whole folder as a single scenario.

## Restaurant orders and delivery

Folders 13 and 14 contain the final twelve routes. Set DEFAULT_DELIVERY_COMPANY_ID in the backend environment to the real company profile ID and restart the backend before acceptance. Use the restaurant login for folder 13, Admin for the first three requests of folder 14, and the assigned company for its remaining requests. Reuse runtime order_id from checkout and driver_id from company driver creation. Actions are state-specific; run them individually.

## Images and health

Folder 15 uses multipart uploads. Choose a local JPEG/PNG/WebP in its `file` field (replace the empty picker); do not set a Content-Type boundary manually. Use Customer login for avatar and Active owner login for restaurant/product/offer images. Product/offer IDs are runtime variables. Folder 16 health requests need no authentication.
