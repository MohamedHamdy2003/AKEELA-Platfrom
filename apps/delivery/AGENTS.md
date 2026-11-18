# Delivery Company Frontend Agent

Follow the root [AGENTS.md](../../AGENTS.md) first. Work in `apps/delivery`; role `Delivery_Company`, origin `delivery.akeelaonline.tech`.

1. Read the [Delivery app guide](../../docs/frontend/AKEELA-Delivery-App.md) for screens, actions and build order. Skip other frontend guides for a delivery-only task.
2. In root Features and Requests/Responses, use shared account/auth routes in 01, company/driver routes in 10 and company order routes in 14. Read common formats, only the response models used, and the Delivery Company role flow. Admin routes in section 14 are not company permissions.
3. Source verification only when needed, relative to `apps/api/src/modules`: `auth/auth.controller.ts`, `auth/auth.dto.ts`, `delivery/delivery.controller.ts`, `delivery/delivery.dto.ts`, `orders/delivery-orders.controller.ts` and `orders/orders.dto.ts`.

Key limits: this is the company/dispatcher app, not driver login. Admin creates the account; company signup is unsupported. Drivers must be active and owned; assignment/change stops after pickup. Only assigned orders are visible. Pickup moves Accepted to Picked_Up; delivery moves Picked_Up to Delivered. No tracking, payouts, proof-of-delivery upload or company failure action exists.

This is an implemented React/Vite/TypeScript app with Arabic RTL and memory-only sessions. Read [portal design](../../docs/PORTAL-DESIGN.md) and [realtime](../../docs/REALTIME.md) for affected work. Run its own check and browser suite. Shared packages/portal changes affect both apps; Restaurant uses its realtime helper.
