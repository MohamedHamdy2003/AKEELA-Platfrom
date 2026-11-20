# AKEELA Delivery Company Application

Frontend design scope for **delivery.akeelaonline.tech**. Login role: `Delivery_Company`.
This application is implemented for the company/dispatcher, not drivers. Production rollout requires DNS/private configuration and verification.

## Read First

Read root [AGENTS.md](../../AGENTS.md) and [this app's instructions](../../apps/delivery/AGENTS.md) for the scoped reading path. Use this guide for screens and permissions; consult only the matching canonical API sections/models for the feature in progress. Do not read other app guides or the full backend for orientation. Existing root specifications remain authoritative; this guide adds no backend features.

API paths omit `/api/v1`. Configure the full API base URL; the backend domain is undecided. This frontend shares the existing backend/database.

## Screens and Features

| Screen                          | Features                                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------------------- |
| Login / Verify Email / Recovery | Access the Admin-created company account; email verification and password recovery.            |
| Home / Assigned Orders          | Show assigned orders and navigation to drivers/profile; no fleet analytics API exists.         |
| Order Details / Dispatch        | Read pickup/delivery locations and saved items, assign/change driver, confirm pickup/delivery. |
| Order History                   | Use status/date filters to view completed/final assigned orders.                               |
| Drivers                         | List, create and edit own drivers; enable/disable activity.                                    |
| Company Profile                 | Read/edit company contact details.                                                             |
| My Account                      | Read/edit login account full name/phone, change password and logout.                           |

## 01. Authentication and Account

| Method | API                         | Screen action                                        |
| ------ | --------------------------- | ---------------------------------------------------- |
| POST   | `/auth/login`               | Email/password login; require Delivery_Company role. |
| POST   | `/auth/verify-email`        | Verify the company login email with OTP.             |
| POST   | `/auth/resend-verification` | Request another email-verification OTP.              |
| POST   | `/auth/forgot-password`     | Request password-reset OTP.                          |
| POST   | `/auth/reset-password`      | Submit email, OTP and new password.                  |
| POST   | `/auth/refresh`             | Rotate the current session tokens.                   |
| POST   | `/auth/logout`              | End the current session.                             |
| GET    | `/me`                       | Read login account and company profile.              |
| PATCH  | `/me`                       | Update login `full_name` and `phone`.                |
| PATCH  | `/me/password`              | Change password; return to login.                    |

- Admin creates the account; there is no company signup page/API. The account must verify its email before login. Drivers do not have login accounts.
- Passwords need 8-128 characters with a letter and digit; phone uses international `+` format. OTP is emailed, not sent to the phone.
- Password changes/resets revoke all sessions. A wrong-role login must not enter the company workspace.
- Account email/role/verification cannot be edited here. Company contact email is a separate editable field, not the login email.

## 02. Company Profile and Drivers

| Method | API                                     | Screen action                            |
| ------ | --------------------------------------- | ---------------------------------------- |
| GET    | `/delivery-company/profile`             | Read own company profile.                |
| PATCH  | `/delivery-company/profile`             | Save company contact details.            |
| GET    | `/delivery-company/drivers`             | Paginated list; optional `is_active=true | false`. |
| POST   | `/delivery-company/drivers`             | Create an owned driver.                  |
| PATCH  | `/delivery-company/drivers/{driver_id}` | Edit driver details/activity.            |

- Company fields: `company_name`, `company_phone`, optional contact `company_email`, `company_address`. Service/account must remain active in the current single-company version; omit a deactivate-company control.
- Driver fields: `driver_name`, `driver_phone`, optional `driver_email`, `is_active`. No password, login role or company selector. Server derives company ownership.
- Edit a driver from list data; no driver detail GET or driver DELETE route exists. Disable instead of deleting. Never move drivers between companies.
- Driver activity does not mean Available/Busy or live online status; no capacity/location API exists. Active drivers may be chosen for dispatch, subject to server validation.
- Before disabling an assigned driver, explain that pickup/delivery requires active drivers. An Accepted order can use another active driver; after pickup, driver changes are forbidden, so an inactive assigned driver must be reactivated to finish delivery. Do not imply automatic reassignment.
- No company logo/avatar/image upload API exists for this role.

## 03. Assigned Orders and History

| Method | API                                   | Screen action                                                                                     |
| ------ | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| GET    | `/delivery-company/orders`            | List only assigned company orders; `page`, `per_page`, optional `status`, `date_from`, `date_to`. |
| GET    | `/delivery-company/orders/{order_id}` | Load saved order data plus current restaurant pickup details.                                     |

- Orders arrive after the restaurant accepts; the company does not browse/claim Pending orders or accept company assignments manually. Backend configuration selects the company.
- List fields: order ID, restaurant ID, company/driver ID, status, total and timestamps. Use details to read full saved items/addons, address, coordinates, notes and fee.
- Pickup contains current restaurant title/address/coordinates. Customer delivery address/coordinates and item prices are checkout snapshots.
- Current responses do not include customer phone, restaurant phone, route ETA or an embedded driver name/contact. Resolve an owned driver through the existing driver list when needed; do not invent response fields or extra GET routes.
- Dates are Cairo `YYYY-MM-DD`; `date_to` includes its whole day. For history use status/date filters, not the customer-only `scope=history` parameter. Final statuses remain read-only.
- No driver filter, route optimization or live map tracking API exists. Coordinate display is supported; a map provider/deep link is a later UI choice, not live tracking.

## 04. Dispatch and Delivery Actions

| Method | API                                           | Request             |
| ------ | --------------------------------------------- | ------------------- |
| PUT    | `/delivery-company/orders/{order_id}/driver`  | `{driver_id: "30"}` |
| POST   | `/delivery-company/orders/{order_id}/pickup`  | No body.            |
| POST   | `/delivery-company/orders/{order_id}/deliver` | No body.            |

| Current state                           | Allowed UI actions                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------- |
| Accepted, no driver                     | Select an active owned driver. Assignment transitions the order to Picked_Up. |
| Picked_Up, active driver                | Confirm delivery; optional driver reassignment via toggle.                    |
| Assigned driver inactive                | Explain the active-driver requirement.                                        |
| Delivered / Failed / other final status | Read only.                                                                    |

- Assigning a driver transitions the order to Picked_Up; delivery changes it to Delivered.
- The company confirms these actions on behalf of its drivers. Do not build a driver login/workspace in this version.
- Confirm delivery and disable actions during submission. After success refetch the order/list. Never provide a generic status dropdown.
- On `DRIVER_REQUIRED`, choose a driver. On `DRIVER_UNAVAILABLE`, refetch driver/order data. On 409 or uncertain network outcome, refetch before retrying; another actor may have marked the order Failed.
- Restaurant suspension does not stop assigned delivery from completing. Company/account/driver activity checks still apply.
- No company cancel/reject/fail/transfer-company action, proof-of-delivery upload, signature or delivery OTP is supported. Admin alone can mark eligible orders Failed.

## UI and Integration Rules

- Design for dispatcher desktop use and usable small screens; use Arabic RTL and responsive small screens. Include loading, empty, confirmation, validation, forbidden, not-found, success and retry states.
- Show field messages from `error.fields` and safe server errors. Do not assume a local hidden button replaces backend authorization.
- Read paginated `data` and `meta`. Keep IDs, coordinates and money as strings. Display EGP and Africa/Cairo time; do not turn current-page sums into company earnings reports.
- JWT access uses Authorization; refresh currently uses JSON tokens. Keep tokens in tab-scoped sessionStorage, coordinate refreshes and avoid retry loops. Reload checks /me before restoring login; see [AUTH](../AUTH.md). No remember-me across browser sessions is implemented. No shared-subdomain SSO or browser-exposed secrets are assumed.
- OTP actions respect cooldown/expiry/errors; recovery messaging stays generic. Socket.IO notifications invalidate order REST reads; reconnect also refreshes. See [realtime](../REALTIME.md).
- Build order: auth → company profile → drivers → assigned orders/details → assignment → pickup/delivery → history/account/security → responsive/error checks.
- Implemented stack: React/Vite/TypeScript, Arabic RTL and tab-scoped sessionStorage sessions. Use the approved identities in [portal design](../PORTAL-DESIGN.md) and the production hostnames in [deployment](../DEPLOYMENT.md).
- Out of scope: driver accounts, tracking, payouts, financial reports, delivery-fee settings, multiple-company routing, payments and new backend endpoints.

Monorepo location: `apps/delivery`. API code is in `apps/api`; shared contracts/docs/Bruno stay at the repository root. The app is implemented using the root npm workspace/lockfile; see [Monorepo](../MONOREPO.md).

## Current implementation

React/Vite/TypeScript, Arabic RTL and tab-scoped sessionStorage sessions. See [portal design](../PORTAL-DESIGN.md) for identity and shared components. Order changes refresh through [Socket.IO](../REALTIME.md). No unsupported business actions were added.
