# Admin and Delivery UI

Both apps use React, Vite, TypeScript, Arabic RTL and self-hosted IBM Plex Sans Arabic. Session tokens survive refresh through tab-scoped sessionStorage; current account data is fetched from /me before rendering the workspace. No cross-domain SSO, localStorage tokens or remember-me behavior is implemented.

## Visual identity

- Admin: dark emerald navigation, porcelain canvas, restrained gold accents. Compact text and clear sections support daily account/restaurant/order review.
- Delivery: deep navy navigation, cool canvas and teal actions. Order state, pickup address, driver assignment and delivery actions have priority.
- Browser tabs use `AKEELA - الإدارة` and `AKEELA - شركة التوصيل`, with app-local shield and truck SVG favicons in `public/favicon.svg`. The Restaurant tab uses `AKEELA - المطعم - <page>` and a storefront favicon. Each HTML entry declares its icon before JavaScript loads; app assets stay same-origin and need no external service.
- Desktop: 236px right sidebar, three real count cards, filters/table, optional left detail pane. Small screens use a keyboard-accessible drawer and stacked sections; tables scroll inside their panels.
- Admin and Restaurant share typography tokens in packages/brand/tokens.css: 16px body/inputs, 14px tables/labels, 15px navigation/buttons, 13px captions, 19px section headings, and 26px desktop/22px phone page titles. Delivery keeps its existing 14px body/12px tables and identity. Original AKEELA logo is preserved. No generated logo or fictional data is shipped.
- Use visible focus, native confirmation dialogs, safe errors, pending-write guards and reduced-motion support. Mutations use REST; realtime notifications only reload order reads.
- User, restaurant and driver lists keep IDs in their own labelled column; the user ID column stays compact. Admin email verification uses only a shield beside the email with an 8px gap, green/red translucent fill and the same border/radius as the account action. The accessible name and hover title explain its state; account/owner details reuse it.
- All three desktop sidebars collapse to an 80px icon rail and expand with a 280ms eased grid transition. Labels fade, the brand mark replaces the wordmark, and active icons keep their names/titles and keyboard navigation. The preference stays in component state. Mobile keeps the full drawer, Escape/focus return and safe resize behavior; reduced motion removes transitions. Shared styles live in packages/brand/sidebar.css; role permissions and routes do not change.
- All three apps import packages/brand/forms.css for single-select arrows: 12px inset from the inline end (left in RTL) and reserved text padding. Native options, keyboard selection, focus and disabled behavior remain; forced-colors mode uses the system arrow. Keep new selects inside the existing field component.

## Code boundaries

Each app keeps routing/session setup in src/app.tsx, role screens in src/features, and its configured HTTP client in src/lib/api.ts. Read only the relevant screen for changes. `packages/portal` contains the HTTP/session client, realtime client, response types, shared form/table/layout components and order/account screens used by both apps. This is a small package for two current consumers, not a new UI framework. Restaurant retains its existing screens and identity.

Design references: [Admin concept](design/admin/concept.png), [Delivery concept](design/delivery/concept.png). Implemented differences: original logo, smaller owner-requested typography, real API counts/IDs, eligible actions only, no invented reports. API payloads and permissions override visual examples.

## Checks

- Root `npm run check` includes both workspaces; each app also has `npm run check` and `npm run test:e2e`.
- Browser tests use explicit fixtures to cover UI actions, error/mobile states and event-driven refresh. Real PostgreSQL integration covers backend permissions, transitions, socket isolation/revocation/expiry and concurrent initialization.
- Use the production smoke stack for Docker/Caddy/TLS/static serving and persistent images. Fixtures alone do not prove real REST integration.
- Browser plugin was unavailable in this environment; Chromium Playwright is the fallback. Inspect both concepts and actual desktop/mobile screenshots before reporting visual completion.

## Admin field language

Admin uses its app-owned Arabic date range fields and Arabic form feedback. The day/month/year selectors keep Gregorian YYYY-MM-DD API values; display digits/month names are Arabic even in English browsers. The Admin workspace provider translates native/inline field feedback while auth pages keep their existing behavior. Entered content and standard email/phone/password/ID formats remain intact. Delivery keeps its current controls. See apps/admin/src/components and src/lib/arabic-fields.ts.
