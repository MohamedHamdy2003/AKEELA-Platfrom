# Restaurant Orders and Delivery

Features 10, 13, and 14 cover delivery company profiles/drivers, restaurant order handling, Admin monitoring/failure, single-query order counts, and Cairo-windowed analytics.

## Delivery company & drivers (Feature 10)

- The `Delivery` module owns `delivery_company_profiles` and `delivery_drivers`. Admin provisions the `Delivery_Company` account via Feature 02; the company manages its own profile (`GET/PATCH /delivery-company/profile`) and paginated drivers (`GET/POST /delivery-company/drivers`, `PATCH /delivery-company/drivers/:driver_id`).
- Drivers are never deleted or moved across companies; deactivate them with `is_active: false` instead.
- Ownership is derived from the authenticated `Delivery_Company` actor (`company_id` is never accepted in request bodies).

## Setup

Set DEFAULT_DELIVERY_COMPANY_ID in the ignored apps/api/.env to the company profile ID returned by Admin account creation or the company profile API, not its user ID. Restart the backend after changing environment settings. Production Compose passes the same key.

Empty configuration is allowed at startup. Acceptance returns 409 DELIVERY_COMPANY_UNAVAILABLE and keeps Pending if configuration is missing, the company does not exist, its service/account is inactive, or its account email is unverified. No default ID is hard-coded and no first-company lookup is used.

The owner confirmed one always-active company for this version. Company creation/profile updates reject is_active=false, and Admin cannot disable Delivery_Company login accounts. Defensive checks remain for out-of-band data changes. Drivers can be disabled; assignment, pickup and delivery require an active owned driver. An active replacement driver may be selected while Accepted or Picked_Up.

## Permissions and transitions

- Active, verified Restaurant accounts require current Active activation for all restaurant order reads/writes. Closing the restaurant service or opening hours does not block handling existing orders. Pending/Suspended activation does.
- Restaurant reads filter by its own restaurant. Delivery reads/writes filter by the assigned company. Admin may read all orders.
- Pending becomes Accepted and receives the configured company in one transaction. Driver stays NULL. Retrying Accepted returns the saved state without choosing a company again, even if configuration has changed.
- Restaurant rejection and customer cancellation apply only to Pending.
- The assigned company chooses an active owned driver while Accepted or Picked_Up. Driver assignment (`PUT /delivery-company/orders/:id/driver`) immediately transitions the order to `Picked_Up`; re-assigning a different driver while already Picked_Up is allowed and keeps the status unchanged.
- Explicit pickup (`POST /delivery-company/orders/:id/pickup`) is idempotent: it succeeds whether the order is Accepted or already Picked_Up, verifying the assigned driver is still active. Delivery (`POST /delivery-company/orders/:id/deliver`) requires Picked_Up and becomes Delivered.
- If a Picked_Up order has not transitioned to Delivered within 90 minutes of its last status update, `OrdersAutoDeliverService` automatically sets the status to Delivered and broadcasts the change via Socket.IO. The scanner runs every 5 minutes (first check after a 1-minute warm-up).
- Admin may fail Accepted or Picked_Up orders. Final states cannot transition. Other action retries return 409 when their required state no longer holds.
- Suspending a restaurant does not stop the assigned company completing delivery. Admin can fail eligible orders for support.
- Prices, items and customer delivery address remain checkout snapshots. Delivery pickup fields use the current restaurant profile.

## Consistency and contracts

Orders owns use cases and queries only its own repositories. Users, Restaurants and Delivery expose transaction-aware methods; none of them writes Orders.

Operational transitions use SERIALIZABLE transactions with up to three attempts for serialization/deadlock conflicts. Lock the acting user, its restaurant profile when applicable, then the order. Default-company and driver validation uses the same transaction manager. Final contention returns 409 ORDER_CONFLICT. Customer cancellation also locks the same order, so acceptance/cancellation and other competing transitions cannot both win.

Lists use shared pagination and optional status/date_from/date_to. Dates are YYYY-MM-DD in Africa/Cairo; date_to includes its entire local day. Reversed/invalid dates return 422. Action bodies are empty except driver assignment, which accepts only driver_id.

Bruno folders 13 and 14 use runtime order_id and driver_id. Log in with the role required by each request; folder 14 includes both Admin and Delivery_Company APIs. Do not run the folders as one automatic scenario.

## Tests

Use `npm run check` and `npm run test:integration`. Tests use the dedicated local PostgreSQL database and Mailpit only. Coverage includes role/ownership, default-company failures, driver activity/ownership, immutable final states, restaurant suspension, acceptance retries, Cairo day boundaries, concurrent state changes, counts, analytics, and idempotent pickup/auto-deliver behaviour.
