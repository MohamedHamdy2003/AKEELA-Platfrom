# AKEELA Admin Application

Frontend design scope for **admin.akeelaonline.tech**. Login role: `Admin`.
This application is implemented locally. Production hosting requires the tested release and valid DNS; see [deployment](../DEPLOYMENT.md).

## Read First

Read root [AGENTS.md](../../AGENTS.md) and [this app's instructions](../../apps/admin/AGENTS.md) for the scoped reading path. Use this guide for screens and permissions; consult only the matching canonical API sections/models for the feature in progress. Do not read other app guides or the full backend for orientation. Existing root specifications remain authoritative; this guide adds no backend features.

API paths omit `/api/v1`. Use a configured full API base URL; the backend domain is undecided. `admin.akeelaonline.tech` hosts the frontend, not a separate backend/database.

## Screens and Features

| Screen                          | Features                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------ |
| Login / Verify Email / Recovery | Access the CLI-created Admin, optional email verification, forgot/reset password.                |
| Home                            | Navigation to restaurant review, users and orders; no analytics endpoint.                        |
| Restaurant Review               | Filter Pending/Active/Suspended profiles; inspect owner/profile and activate/suspend/reactivate. |
| Users                           | Paginated role/activity filters, account/profile details and allowed account activity changes.   |
| Create Delivery Company         | Create company login account and company profile together.                                       |
| Orders                          | Platform order monitoring, status/date filters, order details and eligible failure action.       |
| My Account                      | Read/edit own full name/phone, change password, logout.                                          |

## 01. Authentication and My Account

| Method | API                         | Screen action                                 |
| ------ | --------------------------- | --------------------------------------------- |
| POST   | `/auth/login`               | Email/password login; require Admin role.     |
| POST   | `/auth/verify-email`        | Verify email if CLI provisioning required it. |
| POST   | `/auth/resend-verification` | Request a new verification OTP.               |
| POST   | `/auth/forgot-password`     | Request password-reset OTP.                   |
| POST   | `/auth/reset-password`      | Submit email, OTP and new password.           |
| POST   | `/auth/refresh`             | Rotate the current session tokens.            |
| POST   | `/auth/logout`              | End the current session.                      |
| GET    | `/me`                       | Load Admin identity and profile.              |
| PATCH  | `/me`                       | Edit own `full_name` and `phone`.             |
| PATCH  | `/me/password`              | Change password; log in again afterward.      |

- Exactly one Admin exists, provisioned through CLI. No signup page or Create Admin action. Default trusted CLI setup verifies email; `ADMIN_VERIFIED=false` requires emailed OTP.
- Passwords: 8-128 characters, a letter and digit. Phones: international `+` format. Password changes/resets revoke all sessions.
- A wrong-role account must not enter the Admin workspace. Do not treat a decoded JWT or hidden sidebar as server authorization.
- Email/role/verification/account activity are not editable through My Account. There is no Admin avatar upload route.

## 02. Restaurant Review

| Method | API                                       | Screen action                                                 |
| ------ | ----------------------------------------- | ------------------------------------------------------------- |
| GET    | `/admin/restaurants`                      | List owner/profile review rows; optional `activation_status`. |
| GET    | `/admin/users/{user_id}`                  | Read the owner's full account/profile when needed.            |
| PATCH  | `/admin/restaurants/{rest_id}/activation` | Send `{activation_status: "Active"}` or `"Suspended"`.        |

- Review restaurant identity, description/image, pickup address/coordinates, opening hours, owner contacts, email verification and activation.
- Use `rest_id` for activation and `user_id` for account activity. They are different identifiers.
- Pending → Active approves; Active → Suspended suspends; Suspended → Active reactivates. There is no setter for Pending and no rejection-reason/approval-note field.
- Confirm suspension. It hides the public menu and blocks owner management, but does not delete orders or automatically cancel/refund them. Assigned delivery can finish existing orders.
- Activation, owner login `is_active`, and restaurant service `is_active` are different. Activating does not verify email or enable a disabled login account.
- No Admin restaurant-profile edit, restaurant creation, menu-edit or restaurant-delete API exists. Review detail can use the list's profile; there is no `/admin/restaurants/{rest_id}` GET route.

## 03. Accounts and Company Creation

| Method | API                               | Screen action                                                    |
| ------ | --------------------------------- | ---------------------------------------------------------------- |
| GET    | `/admin/users`                    | List accounts; `page`, `per_page`, optional `role`, `is_active`. |
| GET    | `/admin/users/{user_id}`          | Read account and matching role profile.                          |
| PATCH  | `/admin/users/{user_id}/activity` | Enable/disable an allowed login account using `{is_active}`.     |
| POST   | `/admin/users`                    | Create a Delivery_Company account/profile.                       |

- List all four roles. Show full name, email, phone, role, account activity, verification and profile data returned by the API.
- Activity changes are available for Customer/Restaurant accounts. Do not offer disabling the only Admin or a Delivery_Company account; both are rejected in this version.
- New company account: `full_name`, `email`, `password`, `phone`, fixed `role: "Delivery_Company"`.
- Nested company `profile`: `company_name`, `company_phone`, `company_address`; optional `company_email`; service must remain active. Account email/phone and company contact email/phone are separate fields.
- Send one object, never an array for `profile`. Do not show a selectable Admin/Restaurant/Customer creation role.
- The new company starts email-unverified and must verify email before login. Provisioning returns no company login session. Never display/save the password in the resulting account detail or list.
- Display/copy the returned company profile ID for trusted backend setup if needed. There is no Admin API to change DEFAULT_DELIVERY_COMPANY_ID; configuring it is an operator task.
- There is no Admin edit-other-user-details, role-change, delete-user or company-driver-management API. Customer/restaurant self-registration stays outside this app.

## 04. Order Monitoring

| Method | API                             | Screen action                                                                  |
| ------ | ------------------------------- | ------------------------------------------------------------------------------ |
| GET    | `/admin/orders`                 | List all orders with pagination and optional `status`, `date_from`, `date_to`. |
| GET    | `/admin/orders/{order_id}`      | Read saved order details for support.                                          |
| POST   | `/admin/orders/{order_id}/fail` | Mark Accepted/Picked_Up as Failed. No body.                                    |

| Current status                            | Admin status action                              |
| ----------------------------------------- | ------------------------------------------------ |
| Pending                                   | Read only; no Admin accept/reject/cancel action. |
| Accepted / Picked_Up                      | Confirm Mark Failed.                             |
| Delivered / Rejected / Cancelled / Failed | Read only; final states cannot change.           |

- Show order/customer/restaurant/company/driver IDs, saved address/coordinates, items/addons, quantities, unit prices/subtotals, notes, delivery fee, total and timestamps when returned.
- Company/driver may be null. Current Order payload has IDs rather than full customer/driver/contact records; do not promise an enriched contact panel or unsupported joins. Existing account detail may be loaded separately where its user ID is available.
- Fail is a support action, not a refund. It has no reason/notes body. Confirm before submitting, then refetch order/list.
- Admin never assigns a company/driver or reports pickup/delivery. Acceptance assigns the configured company automatically on the backend.
- Date filters use Cairo days and inclusive `date_to`. No restaurant/company/driver/search query filter exists on this list; do not add unsupported request fields.
- A concurrent delivery/state change can make Fail invalid. On 409 or an uncertain network result, refetch before another action; final statuses must stay immutable.

## UI and Integration Rules

- Include loading, empty, confirmation, success, validation, forbidden, missing-record and retry states. Map `error.fields` to forms and use server messages.
- Lists use paginated `data` and `meta`; show only supported filters. IDs, money and coordinates stay strings. Money is EGP; timestamps display in Africa/Cairo. A page subtotal is not an all-time revenue metric.
- Access JWT uses Authorization; refresh currently uses a JSON token. Tokens stay in memory; reload requires login and no remember-me is implemented. Coordinate refreshes; avoid retry loops, shared-subdomain SSO assumptions and secrets in frontend configuration.
- OTP resend/reset follows server cooldown, expiry and attempt errors; show Retry-After when provided. Recovery uses a generic account-eligibility message.
- Socket.IO notifications invalidate order REST reads; reconnect also refreshes. See [realtime](../REALTIME.md).
- Build order: auth → user list/detail → restaurant approval → company creation → order monitoring/failure → account/security → responsive/error checks.
- Implemented stack: React/Vite/TypeScript, Arabic RTL and memory-only sessions. Use the approved identities in [portal design](../PORTAL-DESIGN.md) and the production hostnames in [deployment](../DEPLOYMENT.md).
- Not supported: creating more Admins, manual company assignment, payment/refund tools, revenue reports, commission settings, general delivery-fee editing, notifications, data export and arbitrary database administration. Ask for specifications/backend APIs before adding them.

Monorepo location: `apps/admin`. API code is in `apps/api`; shared contracts/docs/Bruno stay at the repository root. The app is implemented using the root npm workspace/lockfile; see [Monorepo](../MONOREPO.md).

## Current implementation

React/Vite/TypeScript, Arabic RTL and memory-only sessions. See [portal design](../PORTAL-DESIGN.md) for identity and shared components. Order changes refresh through [Socket.IO](../REALTIME.md). No unsupported business actions were added.
