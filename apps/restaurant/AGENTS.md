# Restaurant Frontend Agent

Follow the root [AGENTS.md](../../AGENTS.md) first. Work in `apps/restaurant`; role `Restaurant`, origin `restaurant.akeelaonline.tech`.

1. Read the [Restaurant app guide](../../docs/frontend/AKEELA-Restaurant-App.md) for screens, forms and build order. Do not read other frontend guides for a restaurant-only task.
2. In root Features and Requests/Responses, use sections 01, 04-08, 13 and the restaurant routes in 15, only as needed for the current feature. Section 09 is optional public-menu preview, not a management API. Read common formats and the referenced response models; use the Restaurant Owner role flow.
3. Source verification, only when needed: `apps/api/src/modules/auth`, `restaurants`, `catalog`, `orders/restaurant-orders.controller.ts`, `orders/orders.dto.ts`, and `images/images.controller.ts`. Start with the exact controller/DTO; do not scan all services/entities.

Key limits: Pending/Suspended permits own account/profile/dashboard reads and security flows, but no management edits/catalog/order/analytics operations. Service `is_active=false` stops new sales only. Acceptance assigns the company automatically; the restaurant never assigns drivers or reports delivery. There are no Preparing/Ready statuses; revenue/menu analytics come strictly from `GET /restaurant/analytics`.

The app is implemented with React/Vite/TypeScript and shared brand assets. Use its workspace checks and Playwright flows for changes; see README.md for commands. Preserve the backend and other apps. Browser sessions survive refresh through tab-scoped sessionStorage; see [AUTH](../../docs/AUTH.md). Registration/profile maps use Leaflet + OpenStreetMap; keep attribution, coordinate strings and activation/save guards.
