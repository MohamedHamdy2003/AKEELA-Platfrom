# AKEELA Restaurant Application

Implementation update (2026-11-14): the local React/Vite Arabic RTL client now implements the supported screens below. See [run guide](../../apps/restaurant/README.md) and [design system](../DESIGN-SYSTEM.md). The owner chose memory-only browser tokens; refresh/reload requires login. The planning statements below describe the original baseline; no public hosting or live authenticated integration verification is implied.

Frontend design scope for **vendor.akeela.com**. Login role: `Restaurant`.
This application is planned; the APIs below already exist. DNS and frontend hosting are not configured by this document.

## Read First

Read root [AGENTS.md](../../AGENTS.md) and [this app's instructions](../../apps/restaurant/AGENTS.md) for the scoped reading path. Use this guide for screens and permissions; consult only the matching canonical API sections/models for the feature in progress. Do not read other app guides or the full backend for orientation. Existing root specifications remain authoritative; this guide adds no backend features.

All API paths below omit `/api/v1`. Configure the full API base URL; the backend domain is not decided here. The vendor domain is a frontend origin, not an API prefix.

## Screens and Features

| Screen                    | Features                                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Register                  | Create owner account and restaurant profile together.                                                          |
| Verify Email              | Submit email OTP; resend with cooldown.                                                                        |
| Login / Password Recovery | Email/password login, forgot password, OTP reset.                                                              |
| Home / Activation         | Show restaurant identity, activation status, server message and `can_manage`. No revenue dashboard API exists. |
| Orders                    | Paginated orders with status/date filters; open order details and act on Pending orders.                       |
| Categories                | Create/edit title, display order and activity.                                                                 |
| Products                  | Create/edit name, description, category, price, activity and image; filter by category.                        |
| Addons                    | Create/edit addon name, price and activity; manage each product's addon links.                                 |
| Offers                    | Create/edit offer details, prices, dates, activity and image.                                                  |
| Restaurant Profile        | Edit restaurant details, pickup location, daily hours, service activity and mobile image.                      |
| My Account                | View owner account; edit full name/phone when Active; change password and log out.                             |

## 01. Registration and Account

| Method | API                         | Screen action                                                     |
| ------ | --------------------------- | ----------------------------------------------------------------- |
| POST   | `/auth/register/restaurant` | Register owner and restaurant.                                    |
| POST   | `/auth/verify-email`        | Verify email using OTP.                                           |
| POST   | `/auth/resend-verification` | Request another verification OTP.                                 |
| POST   | `/auth/login`               | Log in and check role.                                            |
| POST   | `/auth/refresh`             | Rotate tokens for the current session.                            |
| POST   | `/auth/logout`              | End the current session.                                          |
| POST   | `/auth/forgot-password`     | Request a reset OTP.                                              |
| POST   | `/auth/reset-password`      | Submit email, OTP and new password.                               |
| GET    | `/me`                       | Load owner account and role profile.                              |
| PATCH  | `/me`                       | Edit `full_name` and `phone`; do not send customer avatar fields. |
| PATCH  | `/me/password`              | Change password, then return to login.                            |

- Registration: account `full_name`, `email`, `password`, `phone`; nested `profile` with `rest_title`, `rest_address`, `longitude`, `latitude`, `opens_at`, `closes_at`. Description/mobile image URL are optional.
- Password: 8-128 characters with a letter and digit. Phone: international `+` format. OTP goes only to email.
- Registration returns no tokens. Verify email, then log in. Email verification does not activate the restaurant.
- Registration labels `rest_address` as “عنوان المطعم”. With permission, browser `watchPosition` requests fresh high-accuracy device fixes for up to 25 seconds, retaining the best reported accuracy and filling seven-place decimal strings. Acquisition stops early at a reported accuracy of 50m or better; this is a collection heuristic, not a registration requirement or guarantee. Show the reported approximate accuracy in meters; device estimates may be distant and the owner must review the restaurant point. Browser geolocation requires HTTPS or a trusted localhost context.
- An embedded Leaflet 1.9.4 map with OpenStreetMap raster tiles immediately shows/recenters on valid automatic coordinates. Click/tap selects a point; dragging the marker or moving it with arrow keys updates the existing longitude/latitude fields. Manual coordinate edits also move the marker. Manual map/field interaction cancels automatic acquisition so late callbacks cannot overwrite it; explicit retry starts a fresh acquisition. Drag start cancels acquisition before the marker is released. No marker or submitted default location is invented when location is unavailable; the map initially shows a world overview for manual selection.
- Tile loading failure displays a recoverable message/reload control and preserves manual fields. Map/marker/listeners and ResizeObserver clean up on route exit; map movement is unanimated, wheel zoom is disabled to preserve form scrolling, and attribution remains visible. No address search/geocoding or API payload fields are added. The earlier Google Maps copy/paste helper is replaced by direct map interaction.
- Registration now makes direct HTTPS tile requests to OpenStreetMap, including visible map areas. Standard tile use follows [OSM policy](https://operations.osmfoundation.org/policies/tiles/): visible attribution, valid browser referrer and normal HTTP caching, no bulk download/prefetch. Public tile service is best-effort, not unlimited hosting. Optional public build settings `VITE_MAP_TILE_URL` and `VITE_MAP_ATTRIBUTION` allow a suitable alternative provider; attribution HTML is developer-controlled. Production CSP permits HTTPS tiles and data: images for Leaflet’s transparent tile-cancellation placeholder; script/style restrictions remain unchanged. The existing strict-origin-when-cross-origin policy sends the required referrer.
- The existing duplicate-account registration response is shown as an explicit Arabic email/phone conflict with login/verification options, preserving entered data. It does not identify which unique field conflicts, delete accounts or bypass uniqueness. Other conflict responses keep their existing error handling.
- Initial image can be omitted; authenticated file upload is available only after activation. Do not upload files from the public signup form through a protected API.
- A wrong-role login must not open the vendor workspace. Password changes/resets revoke all sessions.

## 02. Activation and Restaurant Profile

| Method | API                         | Screen action                                     |
| ------ | --------------------------- | ------------------------------------------------- |
| GET    | `/restaurant/dashboard`     | Load activation status, message and `can_manage`. |
| GET    | `/restaurant/profile`       | Read restaurant profile.                          |
| PATCH  | `/restaurant/profile`       | Save restaurant details and service activity.     |
| PUT    | `/restaurant/profile/image` | Upload the restaurant mobile image.               |

| State                  | UI behavior                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Pending                | Show waiting-for-approval page and read-only account/profile. Block edits, uploads, catalog and order APIs. |
| Suspended              | Show suspension message and read-only account/profile. Block the same operations as Pending.                |
| Active                 | Enable management. Server still checks current activation on every operation.                               |
| Inactive login account | Deny protected access; activation does not override account activity.                                       |

- Password security, authentication and logout remain available while Pending/Suspended. Refresh status on revisit/manual refresh; no activation push events exist.
- Editable restaurant fields: title, description, mobile image URL, address, coordinates, opening/closing times and `is_active`. Activation is Admin-controlled and never an owner form field.
- The profile form reuses the registration Leaflet picker, initialized from the saved longitude/latitude. Map click/tap, pin drag/arrow keys and manual coordinate inputs update the same draft; the existing PATCH saves its decimal-string fields. It does not automatically replace the saved point with the device location. Pending/Suspended and in-flight saves show a read-only map; failed saves retain the draft.
- Hours are daily Cairo `HH:mm:ss`; overnight hours are supported. Opening and closing cannot be equal. No weekly schedule API exists.
- Service `is_active=false` stops new sales; it does not stop existing order handling when activation stays Active. It is different from Admin suspension and account activity.

## 03. Menu Management

| Method | API                                                | Screen action                                     |
| ------ | -------------------------------------------------- | ------------------------------------------------- |
| GET    | `/restaurant/categories`                           | List owned categories, including inactive ones.   |
| POST   | `/restaurant/categories`                           | Create a category.                                |
| PATCH  | `/restaurant/categories/{cat_id}`                  | Edit title/order/activity.                        |
| GET    | `/restaurant/products`                             | List products; optional `cat_id`.                 |
| GET    | `/restaurant/products/{prod_id}`                   | Load a product for editing.                       |
| POST   | `/restaurant/products`                             | Create a product in an owned category.            |
| PATCH  | `/restaurant/products/{prod_id}`                   | Save product edits.                               |
| PUT    | `/restaurant/products/{prod_id}/image`             | Upload its image after creation.                  |
| GET    | `/restaurant/addons`                               | List owned addons.                                |
| POST   | `/restaurant/addons`                               | Create an addon.                                  |
| PATCH  | `/restaurant/addons/{addon_id}`                    | Edit name/price/activity.                         |
| GET    | `/restaurant/products/{prod_id}/addons`            | Load addon links, including disabled links.       |
| PUT    | `/restaurant/products/{prod_id}/addons/{addon_id}` | Create/enable/disable a link using `{is_active}`. |
| GET    | `/restaurant/offers`                               | List offers, including inactive/expired ones.     |
| POST   | `/restaurant/offers`                               | Create an offer.                                  |
| PATCH  | `/restaurant/offers/{offer_id}`                    | Save offer edits.                                 |
| PUT    | `/restaurant/offers/{offer_id}/image`              | Upload its image after creation.                  |

- Category titles are unique within the restaurant. Display order is a nonnegative integer.
- Product form: `cat_id`, `prod_name`, optional description/image URL, `price`, `is_active`. The server derives ownership; do not invent a `rest_id` body field.
- Addon form: `addon_name`, `addon_price`, `is_active`. Link only owned addons/products. Disable records/links instead of showing unsupported Delete actions.
- Offer form: title, optional description/image URL, `initial_price`, `real_price`, `starts_at`, `expires_at`, `is_active`. Real price cannot exceed initial price; end must follow start. Offers have no addons.
- Offer date inputs mean Cairo time; send Z or the correct explicit offset. Never use a fixed +02 offset for all dates or silently use the browser's timezone.
- Image picker: JPEG/PNG/WebP up to 5MB; multipart field `file`. The server returns `{image_url}` and saves the URL. Show preview, upload progress/error and an image fallback. See [Images](../IMAGES.md).
- There are no owner category/addon/offer detail GET routes: use list row data for those forms. Only use filters supported by the contract; no global server search/bulk-edit API exists.

## 04. Orders

| Method | API                                    | Screen action                                                                        |
| ------ | -------------------------------------- | ------------------------------------------------------------------------------------ |
| GET    | `/restaurant/orders`                   | List with `page`, `per_page`, optional `status`, `date_from`, `date_to`.             |
| GET    | `/restaurant/orders/{order_id}`        | Show saved items/addons, quantities, prices, delivery address, notes, fee and total. |
| POST   | `/restaurant/orders/{order_id}/accept` | Accept Pending; company assignment happens automatically. No body.                   |
| POST   | `/restaurant/orders/{order_id}/reject` | Reject Pending. No body or rejection-reason field.                                   |

- Show Accept/Reject only for Pending; confirm and disable the action while submitting. Do not expose generic status editing, company selection or driver assignment.
- Acceptance returns Accepted with company ID and initially no driver. On `409 DELIVERY_COMPANY_UNAVAILABLE`, explain acceptance failed and refetch; the order remains Pending.
- After Accepted, the restaurant observes delivery updates. There are no Preparing/Ready/Picked Up/Delivered buttons for the restaurant.
- Use saved order names/prices/addons rather than current catalog data. Catalog edits do not rewrite an order.
- After a conflict or uncertain network result, refetch before offering another action. Another role may have cancelled/changed the order.
- Dates filter whole Cairo days; `date_to` is inclusive. Keep final orders accessible through status filters. No customer phone is present in the current Order contract; do not promise a customer-call action.

## UI and Integration Rules

- Include loading, empty, success, validation, forbidden, not-found and retry states. Map `error.fields` to form inputs. On activation denial, refetch profile/dashboard and lock management.
- Read paginated `data` and `meta`; keep IDs, money and coordinates as strings. Display EGP and Cairo time. Do not present page totals as all-time analytics.
- JWT access goes in Authorization. Refresh tokens currently travel in JSON; browser persistence/remember-me is undecided. Coordinate refreshes and never loop retries. Do not assume SSO across subdomains or put secrets in frontend configuration.
- Orders/status use REST refresh; no WebSocket/push API exists. Polling interval, if wanted, is a design decision.
- Proposed build order: auth → activation/profile → categories/products → addons → offers/images → orders → error/responsive checks.
- Before implementation, agree on framework, Arabic/English and RTL, branding, app setup in apps/restaurant, browser token storage and refresh strategy. DNS/Caddy hosting and exact CORS origins need a separate deployment change.
- Out of scope: payments/refunds, revenue reports, notifications, driver tracking, staff accounts, multiple restaurants per owner and new backend endpoints. This file authorizes documentation, not their implementation.

Monorepo location: `apps/restaurant`. API code is in `apps/api`; shared contracts/docs/Bruno stay at the repository root. The app folder is reserved with README only. Use the root npm workspace/lockfile when implementation is authorized; see [Monorepo](../MONOREPO.md).
