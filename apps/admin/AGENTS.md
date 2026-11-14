# Admin Frontend Agent

Follow the root [AGENTS.md](../../AGENTS.md) first. Work in `apps/admin`; role `Admin`, origin `admin.akeela.com`.

1. Read the [Admin app guide](../../docs/frontend/AKEELA-Admin-App.md) for screens, actions and build order. Skip other frontend guides for an Admin-only task.
2. In root Features and Requests/Responses, use shared account/auth routes in 01, Admin routes in 02 and 14, common formats and the response models used by the current feature. Read the Admin role flow. Company creation fields are in section 02; company-only driver routes are not Admin permissions.
3. Source verification only when needed, relative to `apps/api/src/modules`: `auth/auth.controller.ts`, `auth/admin-users-auth.controller.ts`, `auth/auth.dto.ts`, `users/admin-users.controller.ts`, `users/admin.dto.ts`, `restaurants/admin-restaurants.controller.ts`, `orders/admin-orders.controller.ts`, and `orders/orders.dto.ts`.

Key limits: one CLI-created Admin, no Admin signup/creation; never disable it or the company account. Admin approves/suspends restaurants, creates company accounts, monitors orders and may fail Accepted/Picked_Up orders. No manual company/driver assignment, menu management, payments/refunds, revenue dashboard or delivery-fee editing API exists.

The folder is not an implemented app yet. Follow the root frontend checklist when the owner authorizes implementation, including its own workspace checks/CI. Preserve the backend and other apps.
