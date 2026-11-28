# Admin Frontend Agent

Follow the root [AGENTS.md](../../AGENTS.md) first. Work in `apps/admin`; role `Admin`, origin `admin.akeelaonline.tech`.

1. Read the [Admin app guide](../../docs/frontend/AKEELA-Admin-App.md) for screens, actions and build order. Skip other frontend guides for an Admin-only task.
2. In root Features and Requests/Responses, use shared account/auth routes in 01, Admin routes in 02 and 14, common formats and the response models used by the current feature. Read the Admin role flow. Company creation fields are in section 02; company-only driver routes are not Admin permissions.
3. Source verification only when needed, relative to `apps/api/src/modules`: `auth/auth.controller.ts`, `auth/admin-users-auth.controller.ts`, `auth/auth.dto.ts`, `users/admin-users.controller.ts`, `users/admin.dto.ts`, `restaurants/admin-restaurants.controller.ts`, `orders/admin-orders.controller.ts`, and `orders/orders.dto.ts`.

Key limits: one CLI-created Admin, no Admin signup/creation; never disable it or the company account. Admin approves/suspends restaurants, creates company accounts, monitors orders/analytics (`GET /admin/analytics`, `GET /admin/restaurants/:rest_id/analytics`), and may fail Accepted/Picked_Up orders. No manual company/driver assignment, menu management, payments/refunds, or delivery-fee editing API exists.

This is an implemented React/Vite/TypeScript app with Arabic RTL and tab-scoped sessionStorage sessions. Read [portal design](../../docs/PORTAL-DESIGN.md) and [realtime](../../docs/REALTIME.md) for affected work. Run its own check and browser suite. Shared packages/portal changes affect both apps; Restaurant also shares its realtime, session and logout-confirmation helpers.
