# AKEELA design system

## Current visual direction

The owner requested a brighter, more vibrant modern Restaurant interface, smaller typography and more visible interaction motion. Fresh Kitchen uses a near-white warm canvas, white operational surfaces, saturated emerald, orange action emphasis and crisp ink text.

The implementation uses compact Arabic typography, original identity assets, real API data formatting and strict role/activation rules. Restaurant, Admin and Delivery are all implemented and keep distinct identities.

## Identity and assets

- Import [shared tokens](../packages/brand/tokens.css) before app styles via the `@akeela/brand` workspace.
- Preserve the original [wordmark](../packages/brand/assets/logo.png) and [icon](../packages/brand/assets/icon.png). The login panel uses the wordmark in white.
- Browser tabs use app-specific symbols without changing the in-app brand: Restaurant has a storefront in `apps/restaurant/public/favicon.svg`. Its title is `AKEELA - المطعم - <page>`, including login. Admin/Delivery tab identities are documented in [portal design](PORTAL-DESIGN.md).
- [Botanical artwork](../packages/brand/assets/botanical.png) remains on the emerald login panel. Its entry reveal runs once; no continuous floating/decorative loop.
- [Restaurant UI primitives](../apps/restaurant/src/components/ui.tsx) remain app-local, while shared realtime, session-storage, date-field, error-message, and logout-confirmation helpers live in `packages/portal`.

## Tokens

| Role                  | Value                                                                    |
| --------------------- | ------------------------------------------------------------------------ |
| Primary / hover       | `#008657` / `#006d46`                                                    |
| Action / hover        | `#cf480d` / `#b43a06`                                                    |
| Background / surface  | `#fffdf9` / `#ffffff`                                                    |
| Secondary             | `#e7faf0`                                                                |
| Text / muted          | `#17332b` / `#596c64`                                                    |
| Border / accent links | `#e4eae5` / `#c74713`                                                    |
| Success               | `#007b4e` on `#dbf8e9`                                                   |
| Warning               | `#914800` on `#fff0d2`                                                   |
| Error                 | `#c3343f` on `#fff0f1`                                                   |
| Information           | `#205fb8` on `#eaf3ff`                                                   |
| Disabled / focus      | `#eef2ef` / `#00a66b`                                                    |
| Radius                | Controls 12px, panels 16px                                               |
| Shadow                | Panels `0 4px 24px #17332b06`; dialogs retain a stronger separate shadow |

Use white/mint table surfaces, visible status colors and emerald selection. The order CTA uses orange emphasis; ordinary save/confirm actions remain emerald. The login brand panel uses a controlled emerald gradient (`#009b65` → `#007750` → `#005d40`). Analytics charts use real API data from `GET /restaurant/analytics` with no invented or fake statistics.

## Compact Arabic typography

Self-hosted IBM Plex Sans Arabic remains at 400/500/600/700; no font dependency or identity replacement. Admin and Restaurant now share the readable dashboard scale: body/inputs 16px, page/login titles 26px, section headings 19px, navigation/buttons 15px, tables/labels 14px and captions 13px. Phone page/login titles are 22px. The values live in packages/brand/tokens.css; form inputs remain 16px to avoid browser zoom. Keep Arabic line height generous and never add letter spacing. IDs/money remain decimal strings with bidi isolation.

Lucide navigation icons are 20px with the original metaphor/stroke system. Meaningful status icons remain larger. Active navigation combines white text/icons, emerald background, an orange edge indicator and a soft shadow. Status text is always present; color alone is not the state.

## Layout and components

- Desktop right sidebar 248px (240px below 1250px), 64px topbar and 32px main gutters. Below 960px the sidebar becomes a dismissible drawer; phone forms stack below 680px.
- Desktop collapse uses an 80px icon rail, accessible toggle/route names, hover titles and a 280ms eased grid transition from packages/brand/sidebar.css. The mark replaces the wordmark; reduced motion removes transitions. Mobile retains the full-width drawer and activation/keyboard guards. Collapse state is not persisted across reloads.
- The sidebar logo is smaller and the navigation rows are 46px tall. The login form is capped at 440px, registration at 640px; a small wordmark anchors the white form. The brand panel retains room for the original botanical artwork.
- Open headings/status strips lead into white rounded tables. Compact type does not reduce touch targets: ordinary controls stay approximately 46–50px tall, compact actions remain at least 38px. Tables preserve their columns and scroll inside their region on phones.
- Two-column labeled forms retain normal native inputs/selects; focused fields use an emerald border and soft ring. Password controls remain centered against the actual input. Native dialogs keep keyboard focus, Escape and immediate dismissal guards.
- All three apps use packages/brand/forms.css for a consistent single-select arrow with a 12px inset and reserved text space. RTL puts it on the left; LTR and forced-colors mode are supported without replacing native selection.
- Pending is amber, Accepted/Delivered green, Picked_Up blue, Rejected/Failed red, Cancelled neutral. Only existing API enums are valid.
- Skeletons reflect real pending requests; empty/error/success states preserve actual API feedback. All displayed metrics come from real endpoints; no invented preparation statuses, staff accounts, or multi-branch features exist.

## Motion and interaction

Shared timing: micro 150ms, component 240ms, inline feedback 180ms, dialog/drawer 280ms, view 440ms. Entrances decelerate; exits accelerate. No interaction is delayed to wait for decoration.

- Page entry uses an 18px fade/slide. Home heading, service strip, section title and table are staggered by 0/60/100/140ms. Ordinary view changes animate once rather than replaying on API rerenders.
- Table rows reveal over 360ms with short 35ms stagger increments through row six. Hover highlights the row without pretending it is a whole-row action.
- Primary buttons lift 2px on hover with a restrained shadow and a single directional light sweep; arrow affordances move 4px. Press feedback scales to .98. Busy content keeps its original measured layout through the existing label/spinner composition.
- Active navigation has a short edge-indicator reveal; icons shift 3px on hover. Mobile menu items enter in a short stagger. The service switch continues to animate its thumb while preserving pending guards.
- Login heading, subtitle, fields and submit enter in a coordinated sequence. Brand text/artwork reveal once. Field validation and inline notices retain entry/exit feedback.
- Native dialog close releases focus/pointer access immediately. [Presence](../apps/restaurant/src/components/presence.tsx) retains only an inert visual tail for the shared 280ms duration; rapid reopen receives fresh state and timers clean up. Drawers travel 40px; dialogs use 18px/0.97 entry. Existing guards still control dismissal during writes.
- Loading skeletons combine a slow opacity pulse and moving highlight. These loops exist only while actual data is pending.
- `prefers-reduced-motion` removes animations/transitions and retained exit duration, hides sweep/shimmer, and prevents hover/press translation/scale. Controls remain fully functional.

## Map interaction

Registration/profile reuse a 320px Leaflet map (280px on phones). The emerald SVG pin anchors exactly at its bottom center. Map content is internally LTR within the RTL form. Automatic registration fixes, click/tap, pin drag/arrow keys and manual fields stay synchronized. Profile starts from the saved point and disables selection for Pending/Suspended or in-flight saves. No map pan/zoom animation or fabricated location is used. Attribution stays visible and tile failure keeps manual/reload fallback.

## Fidelity and browser QA

UI text stays code-native with original AKEELA assets, real Cairo dates, and Arabic EGP currency formatting. Playwright browser QA covers dashboard, analytics, catalog, orders, login, responsive layouts, focus, interruption, and reduced motion using isolated fixtures.
