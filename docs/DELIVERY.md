# Delivery Company and Drivers

Feature 10 implements the five routes in the root API specifications. Driver IDs and company IDs are decimal strings.

- Only a verified, active Delivery_Company account can access these routes. Company ownership comes from the signed-in user.
- Profile updates allow contact details and service activity only. They do not change login account data.
- Drivers have no login. Company IDs cannot be changed through driver requests. Disable drivers instead of deleting them.
- Lists use shared pagination and optional `is_active=true|false` filtering.
- Company service/account must remain active in the current single-company version. Creation/profile updates with is_active=false and disabling Delivery_Company accounts return 409. Driver activity remains editable. See [ORDER-DELIVERY.md](ORDER-DELIVERY.md) for assignment and delivery.
- Migration `CreateDeliveryDrivers` adds the driver table, restricted company FK, and unique `(company_id, driver_id)` index for future order references.
- Bruno requests are in `10 - Delivery Company and Drivers`. Log in as a company; Add driver sets the runtime `driver_id` used by Update driver.

Tests use only the dedicated local PostgreSQL test database. No production deployment or real delivery operations are included.
