# Cart and Customer Orders

Features 11 and 12 implement the ten customer routes from the root specifications. Restaurant acceptance and delivery actions are implemented in Features 13 and 14; see [ORDER-DELIVERY.md](ORDER-DELIVERY.md).

## Confirmed behavior

- Currency: EGP. Initial general delivery fee: 30.00, defined once in cart.types.ts. The Admin endpoint for managing the fee is a future feature.
- A customer has one cart for one restaurant. Switching requires explicitly clearing it; the server returns 409 rather than clearing it automatically.
- Matching product/addon choices merge quantities when their per-product addon ratios match. Different addon choices or ratios remain separate. Addon quantities mean total addon units per line.
- PATCH addons replaces the complete selection. An omitted selection stays unchanged; changing an item quantity with existing addons requires the intended total addon quantities. Quantity zero removes the line.
- Either address_id for an owned saved address or delivery_address with address_line/longitude/latitude is required for quote/checkout. New addresses are not saved in Customer_Addresses.
- Quote returns current totals, not a token or price reservation. Checkout always calculates current prices and creates the order directly; it does not compare a previously shown total.
- There are no checkout keys, request hashes or replay guarantees. Concurrent checkout of the same cart cannot create two orders: the first clears it and the next sees an empty cart. Rebuilding the cart and submitting again can create a new order.
- No business caps on cart size, addon count or quantities. Quantities must fit PostgreSQL INTEGER and calculated amounts must fit numeric(12,2). Overflow rejects the transaction without changing the cart.
- Unavailable selections can be viewed/removed; additions, edits, quote and checkout validate restaurant/account/category/item/link activity. Checkout and quote require the restaurant to be open in Africa/Cairo.

## Transactions and ownership

Cart exposes a transaction method and explicit snapshot/clear methods for Orders. Customers, Restaurants and Catalog expose transaction-aware lookups. Orders never queries another module's tables directly.

Transactions use PostgreSQL SERIALIZABLE snapshots. Lock the customer profile before the cart; this also protects first-cart creation. Cart writes and checkout lock the cart row. Serialization/deadlock/unique races retry at most three times, then return 409 CART_CONFLICT. No network work happens inside these transactions.

Checkout creates an order with NULL company/driver and Pending status, item/addon snapshots and generated subtotals, then deletes the cart in the same transaction. Names, prices and delivery address are independent of later edits. Failures roll everything back.

Customer cancellation locks the owned order and requires Pending. History is a view of final states, with customer filtering enforced by the service. Lists use the shared pagination contract.

## Migrations and testing

CreateCarts and CreateOrders are explicit reversible migrations. The latter registers generated-column/view metadata for TypeORM schema checks. Never run migrations automatically.

Use npm run check and npm run test:integration. Integration tests run against the dedicated local test database and local Mailpit only. They cover cart races, ownership, visibility, current-price checkout, rollback, snapshots, cancellation/history and schema agreement.

The rollback test intentionally injects a database error and expects a sanitized server error log. It verifies that the order is rolled back and the cart remains saved.
