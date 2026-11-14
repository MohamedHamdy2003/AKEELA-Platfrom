# AKEELA design system

## Current visual direction

The owner requested a brighter, more vibrant modern Restaurant interface, smaller typography and more visible interaction motion. Fresh Kitchen replaces the muted Garden Kitchen treatment: near-white warm canvas, white operational surfaces, saturated emerald, orange action emphasis and crisp ink text. [Dashboard concept](design/restaurant/home-v2.png) and [login concept](design/restaurant/login-v2.png) guide palette, hierarchy and component treatment.

The implementation follows the owner's explicit compact-type request rather than the generated images' oversized lettering. Original identity assets, supported copy, real data formatting and all API/permission rules remain authoritative. Only Restaurant is implemented; future products may consume the shared brand tokens without inheriting its workflows.

## Identity and assets

- Import [shared tokens](../packages/brand/tokens.css) before app styles. Future consumers use the existing `@akeela/brand` workspace and root lockfile.
- Preserve the original [wordmark](../packages/brand/assets/logo.png) and [icon](../packages/brand/assets/icon.png); generated concepts contain approximate logo variants that are not replacement assets. The login panel uses the wordmark in white.
- [Botanical artwork](../packages/brand/assets/botanical.png) remains on the emerald login panel. Its entry reveal runs once; no continuous floating/decorative loop.
- [Restaurant UI primitives](../apps/restaurant/src/components/ui.tsx) remain app-local. Do not introduce a shared React library before another implemented app needs it.

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

Use white/mint table surfaces, visible status colors and emerald selection. The home order CTA uses orange emphasis; ordinary save/confirm actions remain emerald. The login brand panel uses a controlled emerald gradient (`#009b65` → `#007750` → `#005d40`). No gray canvas, invented metric cards, charts or ornamental dashboard widgets.

## Compact Arabic typography

Self-hosted IBM Plex Sans Arabic remains at 400/500/600/700; no font dependency or identity replacement. Desktop body 15px, page title 30px, login title 32px, section headings 22px, navigation 16px, table text 14px, captions 12–14px. Phone page titles are 24px/login 28px; phone inputs stay 16px to avoid browser zoom. Keep Arabic line height generous and never add letter spacing. IDs/money remain decimal strings with bidi isolation.

Lucide navigation icons are 20px with the original metaphor/stroke system. Meaningful status icons remain larger. Active navigation combines white text/icons, emerald background, an orange edge indicator and a soft shadow. Status text is always present; color alone is not the state.

## Layout and components

- Desktop right sidebar 248px (240px below 1250px), 64px topbar and 32px main gutters. Below 960px the sidebar becomes a dismissible drawer; phone forms stack below 680px.
- The sidebar logo is smaller and the navigation rows are 46px tall. The login form is capped at 440px, registration at 640px; a small wordmark anchors the white form. The brand panel retains room for the original botanical artwork.
- Open headings/status strips lead into white rounded tables. Compact type does not reduce touch targets: ordinary controls stay approximately 46–50px tall, compact actions remain at least 38px. Tables preserve their columns and scroll inside their region on phones.
- Two-column labeled forms retain normal native inputs/selects; focused fields use an emerald border and soft ring. Password controls remain centered against the actual input. Native dialogs keep keyboard focus, Escape and immediate dismissal guards.
- Pending is amber, Accepted/Delivered green, Picked_Up blue, Rejected/Failed red, Cancelled neutral. Only existing API enums are valid.
- Skeletons reflect real pending requests; empty/error/success states preserve actual API feedback. No invented revenue, preparation statuses, staff, branches or notification features.

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

## Fidelity and functional scope

The v2 concepts define color, compact component families, active navigation, service strip, table anatomy and login composition. Deliberate differences: smaller type honors the owner's explicit request; the original logo/artwork replace generated approximations; existing API copy/nav/OTP link remain; real Cairo dates, historical order dates, Arabic currency and data replace illustrative values. The app still contains no fake statistics or extra navigation. Existing order/form concepts remain [workflow references](design/restaurant/orders.png), [form references](design/restaurant/forms.png); [previous home](design/restaurant/home.png), [previous login](design/restaurant/login.png) and [brand exploration](design/restaurant/brand-directions.png) are historical visual references, not current color/type specifications.

Browser QA compares dashboard/login and shared form/table/dialog states, checking palette, type sizes, original assets, spacing, responsive layout, hover/press/loading, focus, interruption and reduced motion. Tests use isolated API/location/tile fixtures; final screenshots/video live outside the repository. An exhaustive accessibility/performance audit remains separate work.

## Refresh comparison ledger

| Check           | Concept/render evidence and resolution                                                                                                                                                                               |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette         | V2 emerald navigation, orange order CTA, mint service/table header and near-white canvas are implemented through shared tokens; old gray/sage backgrounds were replaced.                                             |
| Typography      | Rendered desktop title 30px, body 15px, navigation 16px/table 14px were measured. Smaller than generated concepts intentionally follows the owner's explicit compact-type request.                                   |
| Identity/icons  | Original wordmark and botanical assets are retained instead of approximate generated logos; original Lucide workflow metaphors remain at compact sizes.                                                              |
| Layout          | RTL sidebar, heading/CTA, service strip, single operational table and login split match the concept hierarchy, with compact 248px sidebar and 440px form. No metric cards/new controls were added.                   |
| Copy/data       | Existing navigation, auth/OTP actions, API status wording, actual Cairo dates and currency remain; illustrative concept wording/data are not introduced as features.                                                 |
| Interaction     | Browser verification covers hover lift/sweep/arrows, row stagger, busy geometry, dialog/focus/rapid reopen, phone navigation and reduced motion. One hover-specific reduced-motion override was corrected during QA. |
| Responsive/maps | Desktop/phone/tablet screenshots show the smaller type, bounded table scrolling, single-column forms, dismissible sidebar and visible OSM attribution without page overflow.                                         |

No unexplained visual mismatch remains against this working specification. UI text stays code-native; screenshots are references/evidence only.
