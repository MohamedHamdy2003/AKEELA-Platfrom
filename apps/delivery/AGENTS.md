# Delivery Company Frontend Agent

Follow the root [AGENTS.md](../../AGENTS.md) first. Work in `apps/delivery`; role `Delivery_Company`, origin `delivery.akeela.com`.

1. Read the [Delivery app guide](../../docs/frontend/AKEELA-Delivery-App.md) for screens, actions and build order. Skip other frontend guides for a delivery-only task.
2. In root Features and Requests/Responses, use shared account/auth routes in 01, company/driver routes in 10 and company order routes in 14. Read common formats, only the response models used, and the Delivery Company role flow. Admin routes in section 14 are not company permissions.
3. Source verification only when needed, relative to `apps/api/src/modules`: `auth/auth.controller.ts`, `auth/auth.dto.ts`, `delivery/delivery.controller.ts`, `delivery/delivery.dto.ts`, `orders/delivery-orders.controller.ts` and `orders/orders.dto.ts`.

Key limits: this is the company/dispatcher app, not driver login. Admin creates the account; company signup is unsupported. Drivers must be active and owned; assignment/change stops after pickup. Only assigned orders are visible. Pickup moves Accepted to Picked_Up; delivery moves Picked_Up to Delivered. No tracking, payouts, proof-of-delivery upload or company failure action exists.

The folder is not an implemented app yet. Follow the root frontend checklist when the owner authorizes implementation, including its own workspace checks/CI. Preserve the backend and other apps.
