# Admin and Delivery UI

Both apps use React, Vite, TypeScript, Arabic RTL and self-hosted IBM Plex Sans Arabic. Session tokens survive refresh through tab-scoped sessionStorage; current account data is fetched from /me before rendering the workspace. No cross-domain SSO, localStorage tokens or remember-me behavior is implemented.

## Visual identity

- Admin: dark emerald navigation, porcelain canvas, restrained gold accents. Compact text and clear sections support daily account/restaurant/order review.
- Delivery: clean white navigation mirroring Restaurant's airy aesthetic, near-white alabaster canvas (`#fafbfd`), refined sapphire-slate (`#1b5ca8`) actions with warm amber-terracotta (`#d96b27`) active edge markers, and flat white-label company identity in the navbar/sidebar/profile (no flashy gradients or neon glows). Order state, pickup address, driver assignment and delivery actions have priority.
- Browser tabs use `AKEELA - الإدارة` and `AKEELA - شركة التوصيل`, with app-local shield and truck SVG favicons in `public/favicon.svg`. The Restaurant tab uses `AKEELA - المطعم - <page>` and a storefront favicon. Each HTML entry declares its icon before JavaScript loads; app assets stay same-origin and need no external service.
- Desktop: 236px right sidebar, three real count cards, filters/table, optional left detail pane. Small screens use a keyboard-accessible drawer and stacked sections; tables scroll inside their panels.
- Admin restaurant review and account details use the app-owned `DetailWorkspace`, matching the order view's left-card layout. The 380px desktop pane (340px on medium desktops) slides/fades in from the physical left over 280ms while the list resizes; it has a sticky header, close control, scrollable long content and selected-row highlight. On screens up to 1080px the pane appears before the list and is brought into view, rather than below a long table. It is non-modal: the list stays usable. Close/Escape retain content through exit and return focus to the originating row; native confirmation/verification dialogs own Escape first. Reduced motion removes animations and close delay. Admin company account details reuse this same account view; Order, Delivery and Restaurant app components are unchanged.
- Admin, Delivery and Restaurant share typography tokens in packages/brand/tokens.css: 16px body/inputs, 14px tables/labels, 15px navigation/buttons, 13px captions, 19px section headings, and 26px desktop/22px phone page titles. Original AKEELA logo is preserved. No generated logo or fictional data is shipped.
- Use visible focus, native confirmation dialogs, safe errors, pending-write guards and reduced-motion support. Mutations use REST; realtime notifications only reload order reads.
- Logout in all three dashboards opens packages/portal's shared confirmation dialog. Opening/canceling sends no logout request. Cancel receives initial focus; Escape/close restores the trigger, or the menu button on phones. Confirmation revokes the current session through the existing route, then clears saved tokens. Pending requests prevent duplicates/dismissal and preserve button size; failures show an Arabic retry message and retain the session until confirmed success or server rejection. Native modal focus, body scroll restoration, app accent colors and reduced motion are preserved.
- User, restaurant and driver lists keep IDs in their own labelled column; the user ID column stays compact. Admin email verification uses only a shield beside the email with an 8px gap, green/red translucent fill and the same border/radius as the account action. The accessible name and hover title explain its state; account/owner details reuse it.
- Delivery_Company shields are native buttons opening the Admin verification dialog; other roles keep non-interactive indicators. The app-owned rounded dialog retains native focus/Escape behavior, blocks dismissal only while a request is pending, scopes its CSS and respects reduced motion. See the [Admin guide](frontend/AKEELA-Admin-App.md) for the existing OTP contract and cooldown rules.
- All three desktop sidebars collapse to an 80px icon rail and expand with a 280ms eased grid transition. Labels fade, the brand mark replaces the wordmark, and active icons keep their names/titles and keyboard navigation. The preference stays in component state. Mobile keeps the full drawer, Escape/focus return and safe resize behavior; reduced motion removes transitions. Shared styles live in packages/brand/sidebar.css; role permissions and routes do not change.
- All three apps import packages/brand/forms.css for single-select arrows: 12px inset from the inline end (left in RTL) and reserved text padding. Native options, keyboard selection, focus and disabled behavior remain; forced-colors mode uses the system arrow. Keep new selects inside the existing field component.

## Code boundaries

Each app keeps routing/session setup in src/app.tsx, role screens in src/features, and its configured HTTP client in src/lib/api.ts. Read only the relevant screen for changes. `packages/portal` contains the HTTP/session client, realtime client, response types, shared form/table/layout components and order/account screens used by both apps. All three apps reuse its focused logout-confirmation component; Restaurant retains its other screens and identity. This is not a general UI framework.

Design references: [Admin concept](design/admin/concept.png), [Delivery concept](design/delivery/concept.png). Implemented differences: original logo, smaller owner-requested typography, real API counts/IDs, eligible actions only, no invented reports. API payloads and permissions override visual examples.

## Checks

- Root `npm run check` includes both workspaces; each app also has `npm run check` and `npm run test:e2e`.
- Browser tests use explicit fixtures to cover UI actions, error/mobile states and event-driven refresh. Real PostgreSQL integration covers backend permissions, transitions, socket isolation/revocation/expiry and concurrent initialization.
- Use the production smoke stack for Docker/Caddy/TLS/static serving and persistent images. Fixtures alone do not prove real REST integration.
- Browser plugin was unavailable in this environment; Chromium Playwright is the fallback. Inspect both concepts and actual desktop/mobile screenshots before reporting visual completion.

## Admin field language

Admin and Delivery share the Arabic date range fields (`packages/portal/src/arabic-date-fields.tsx`). The day/month/year selectors keep Gregorian YYYY-MM-DD API values; display digits/month names are Arabic even in English browsers. The Admin workspace provider translates native/inline field feedback while auth pages keep their existing behavior. Entered content and standard email/phone/password/ID formats remain intact. See apps/admin/src/components and src/lib/arabic-fields.ts.

## Activity and detail surfaces

- Boolean activity uses the shared `packages/brand/activity.css` badge: translucent green for active and red for inactive, with a dot and readable label. Order and restaurant approval statuses retain their distinct meanings/colors.
- Admin account/review panes and Admin/Delivery order details reuse `packages/portal/src/detail-workspace.tsx`. Details enter from the physical left, retain content during close, restore focus, and respect reduced motion. On narrow screens the pane precedes the list. Restaurant keeps its existing animated modal drawer.
- Account panes use a plain border with no colored top stripe. Admin navigation retains emerald/gold with subdued default items and an outlined selected item. Delivery auth keeps its original logo shape in white on navy; picture-wrapped images must receive the logo styling.
- Use CSS motion and existing assets; no animation library or additional image downloads are required for these refinements.
