# AKEELA — API Features

Build features in the order below. Routes use the `/api/v1` prefix, omitted from the tables.

## Common Rules

- Roles: `Customer`, `Restaurant`, `Delivery_Company`, `Admin`.
- Require an active, email-verified login except for public auth routes and public menu routes. Refresh uses a valid refresh token, not an access JWT.
- Check role and record ownership on the server. Never trust an owner ID sent by the client.
- `/customer/*` routes are for the signed-in Customer; get the customer ID from the verified JWT, not a route parameter. `/me` and `/me/password` are shared account routes for all roles.
- Validate input. Use pagination for lists and one clear response/error format.
- Use `is_active` to disable catalog records. Keep order history unchanged.
- Follow the keys, checks, and transactions in `AKEELA-DB-Design.md`.
- This plan covers the current database scope. Payments, reviews, notifications, and driver login are outside this version.

## 01. Authentication and My Profile

**Rules**

- All BIGINT IDs are returned and accepted as decimal strings. Registration requires `full_name`, `email`, `password`, and `phone`. Map `phone` to `Users.phone_number`.
- Customer registration creates a Customer and its profile. Restaurant registration creates a Restaurant and its profile with `activation_status = Pending`. Create both in one transaction. Email and phone must be unique. Public registration cannot create Admin or Delivery_Company accounts.
- Passwords are 8–128 characters with at least one letter and one digit; phones use international `+` format. Restaurant registration requires title, address, coordinates, and opening/closing times; description and image URL are optional.
- Login uses email and password. Verify only the email by OTP; no phone OTP is required.
- Send the email OTP after registration. Keep `email_verified_at` NULL until verification succeeds. Do not issue login tokens before email verification.
- Use short-lived JWT access tokens and rotating refresh tokens. Check token signature, expiry, issuer, audience, account activity, verified email, and session revocation on protected requests.
- Logout revokes the current session; password changes and resets revoke all sessions. Never return password hashes or saved token/OTP hashes.
- Approved defaults: access JWT 15 minutes, refresh session 30 days, OTP 6 digits for 10 minutes with 5 attempts and a 60-second resend cooldown. Limits and lifetimes are configurable. SMTP is configured through environment variables; local development uses Mailpit.
- Email verification and password reset use separate OTP purposes. Codes expire, work once, and have attempt limits. Resending replaces the previous code and has a cooldown; rate-limit requests by account and IP.
- Store only protected OTP hashes and refresh-token hashes. Do not put codes in logs or API responses.
- Forgot-password sends a password-reset OTP to the account email. Reset-password requires `email`, `otp`, and `new_password`; verify and consume the OTP in the same transaction as the password update.
- Forgot-password and resend endpoints return a general response whether the email exists or not.
- Profile updates cannot change role, account activity, restaurant activation status, email, or verification fields. Email changes need a separate verified flow later. Phone updates require uniqueness, not OTP.

| Method | Route | Purpose |
|---|---|---|
| POST | `/auth/register` | Create an unverified customer with full name, email, password, and phone; send an email OTP. |
| POST | `/auth/register/restaurant` | Create an unverified restaurant owner and Pending restaurant profile; send an email OTP. |
| POST | `/auth/verify-email` | Verify `email` and `otp`, then set `email_verified_at`. The user can log in afterward. |
| POST | `/auth/resend-verification` | Send a new email-verification OTP, subject to cooldown and limits. |
| POST | `/auth/login` | Check email and password; issue tokens only for an active, verified account. |
| POST | `/auth/refresh` | Rotate a valid refresh token and issue a new JWT access token. |
| POST | `/auth/logout` | Revoke the current login session and its refresh token. |
| POST | `/auth/forgot-password` | Request a password-reset OTP by email. |
| POST | `/auth/reset-password` | Check email and reset OTP, save the new password hash, consume the code, and revoke all sessions. |
| GET | `/me` | Return shared account data and the matching role profile. |
| PATCH | `/me` | Update allowed profile fields, including full name, phone, and customer avatar. |
| PATCH | `/me/password` | Check the current password, save the new password hash, and revoke all sessions. |

## 02. Admin — Accounts

**Rules**

- Admin only. Create the first Admin through a setup command or seed, not public registration.
- Create each account and matching profile in one transaction. Email is required for all roles; restaurant, company, and admin accounts also verify their email before login. Verify the setup Admin through the same flow.
- Do not allow direct role changes. Keep existing orders when disabling an account.
- Prevent disabling the last active Admin.
- Restaurants register themselves. Admin reviews Pending restaurants and may set their activation status to Active or Suspended; a Suspended restaurant may be reactivated.
- Activation is separate from email verification and account login activity. Activation never bypasses those checks.

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/users` | List accounts; filter by role or activity. |
| GET | `/admin/users/{user_id}` | Read an account and its profile. |
| POST | `/admin/users` | Create a Delivery_Company or Admin account and profile. |
| PATCH | `/admin/users/{user_id}/activity` | Enable or disable login for an account. |
| GET | `/admin/restaurants` | List restaurant owners and profiles; filter by activation status for review. |
| PATCH | `/admin/restaurants/{rest_id}/activation` | Activate, suspend, or reactivate a restaurant. |

## 03. Customer Addresses

**Rules**

- Customer only; read and change only the customer's own addresses.
- Each customer may save at most 2 addresses. Allow at most one default address.
- Validate full address and coordinates. Changing the default is one transaction. Address changes never change old orders.
- During cart quote and order checkout, customers can select one of their saved addresses or provide a one-time delivery address and coordinates without saving it into customer addresses.

| Method | Route | Purpose |
|---|---|---|
| GET | `/customer/addresses` | List saved addresses. |
| POST | `/customer/addresses` | Save an address. |
| PATCH | `/customer/addresses/{address_id}` | Update an owned address. |
| PUT | `/customer/addresses/{address_id}/default` | Make an owned address the default. |
| DELETE | `/customer/addresses/{address_id}` | Remove an owned saved address. |

## 04. Restaurant Profile

**Rules**

- Restaurant only; manage the restaurant linked to the signed-in account.
- After email verification, Pending and Suspended owners can log in and read `/me`, `/restaurant/profile`, and `/restaurant/dashboard`. Dashboard shows the activation status and whether management is allowed.
- Block all other restaurant business APIs until activation is Active, including catalog reads/writes and order handling. Return `403 RESTAURANT_NOT_ACTIVE`. Authentication, logout, and password flows remain available. Shared profile edits are blocked too while the restaurant is not Active.
- Only Admin can change `activation_status`; restaurant profile updates cannot change it. Check the current database value on every business request, including existing JWT sessions.
- Suspension immediately hides the restaurant and its menu and blocks new cart additions, quotes, checkout, and restaurant order handling. Existing orders stay saved; assigned delivery companies can finish delivery and Admin can handle eligible failures. No automatic cancellation or refund is assumed.
- Allow updates to title, description, mobile image URL, pickup address, coordinates, opening hours, and `is_active`.
- Apply the opening-hour and coordinate rules in the database design.

| Method | Route | Purpose |
|---|---|---|
| GET | `/restaurant/profile` | Read the restaurant's own profile, including activation status. |
| GET | `/restaurant/dashboard` | Read account activation status and whether restaurant management is allowed. |
| PATCH | `/restaurant/profile` | Update restaurant details and service activity. |

## 05. Categories

**Rules**

- Restaurant only; manage only its own categories.
- Category titles must be unique within the restaurant. Validate display order.
- Use PATCH to disable a category instead of deleting linked history.

| Method | Route | Purpose |
|---|---|---|
| GET | `/restaurant/categories` | List owned categories, including inactive ones. |
| POST | `/restaurant/categories` | Create a menu category. |
| PATCH | `/restaurant/categories/{cat_id}` | Update title, display order, or activity. |

## 06. Products

**Rules**

- Restaurant only; the product and category must belong to its restaurant.
- Validate price. Use `is_active` for product availability in this version.
- Price and name edits must not change saved order snapshots.

| Method | Route | Purpose |
|---|---|---|
| GET | `/restaurant/products` | List owned products; optionally filter by category. |
| GET | `/restaurant/products/{prod_id}` | Read product details for editing. |
| POST | `/restaurant/products` | Create a product in an owned category. |
| PATCH | `/restaurant/products/{prod_id}` | Update product details, price, category, or activity. |

## 07. Addons and Product Links

**Rules**

- Only the owning Restaurant user manages addons and product links.
- Product and addon must belong to the same restaurant. Prevent duplicate links.
- Disable used addons/links instead of deleting them. Customers only select them in the cart.

| Method | Route | Purpose |
|---|---|---|
| GET | `/restaurant/addons` | List owned addons. |
| POST | `/restaurant/addons` | Create an addon and its price. |
| PATCH | `/restaurant/addons/{addon_id}` | Update addon name, price, or activity. |
| GET | `/restaurant/products/{prod_id}/addons` | List the product's addon links, including inactive links. |
| PUT | `/restaurant/products/{prod_id}/addons/{addon_id}` | Create a link or enable/disable an existing link. |

## 08. Offers

**Rules**

- Restaurant only; manage only its own offers.
- Validate prices and start/end times. Sell only active, unexpired offers within their sale window.
- Offers are separate sale items. They have no addons in this version.

| Method | Route | Purpose |
|---|---|---|
| GET | `/restaurant/offers` | List owned offers, including inactive and expired ones. |
| POST | `/restaurant/offers` | Create an offer. |
| PATCH | `/restaurant/offers/{offer_id}` | Update offer details, prices, dates, or activity. |

## 09. Public Restaurant Menu

**Rules**

- No login required. Return public menu data only, never account credentials or private profile data.
- Hide restaurants whose activation status is not Active. Hide inactive restaurants/accounts, categories, products, addons, and links. Show offers only within their sale window.
- Return restaurant opening status. Being closed does not have to hide its menu.

| Method | Route | Purpose |
|---|---|---|
| GET | `/restaurants` | Browse active restaurants. |
| GET | `/restaurants/{rest_id}` | Read public restaurant details and opening hours. |
| GET | `/restaurants/{rest_id}/categories` | Read categories in display order. |
| GET | `/restaurants/{rest_id}/products` | Browse products; optionally filter by category. |
| GET | `/restaurants/{rest_id}/products/{prod_id}` | Read a product and its allowed active addons. |
| GET | `/restaurants/{rest_id}/offers` | Browse offers available for sale. |
| GET | `/restaurants/{rest_id}/offers/{offer_id}` | Read an available offer. |

## 10. Delivery Company and Drivers

**Rules**

- Delivery_Company only; manage its own profile and drivers.
- Drivers have no login accounts. Use `is_active` to disable drivers.
- Do not move a driver record linked to past orders to another company.

| Method | Route | Purpose |
|---|---|---|
| GET | `/delivery-company/profile` | Read the company's own profile. |
| PATCH | `/delivery-company/profile` | Update company contact details and service activity. |
| GET | `/delivery-company/drivers` | List the company's drivers. |
| POST | `/delivery-company/drivers` | Add a driver to the company. |
| PATCH | `/delivery-company/drivers/{driver_id}` | Update driver details or activity. |

## 11. Customer Cart

**Rules**

- Customer only; additions and edits require an Active restaurant activation status. Existing unavailable selections may still be viewed or removed. One cart for one restaurant. Confirm clearing it before switching restaurants.
- Each item is one product or one offer. Keep separate rows for different addon choices.
- Addon quantity means total addon units for the item, not quantity per product.
- Set the full desired addon selection when updating an item; validate all links and quantities together.
- Read current prices from the catalog. Lock the parent cart during each write transaction.
- Removing cart data must not remove orders or history.

| Method | Route | Purpose |
|---|---|---|
| GET | `/customer/cart` | Read the cart, selected addons, and current calculated prices. Return an empty cart if none exists. |
| POST | `/customer/cart/items` | Add a product or offer, quantity, and chosen addons; create the cart if needed. |
| PATCH | `/customer/cart/items/{cart_item_id}` | Update quantity and addon choices for an owned item. |
| DELETE | `/customer/cart/items/{cart_item_id}` | Remove an item and its selected addons. |
| DELETE | `/customer/cart` | Clear the cart and its items. |
| POST | `/customer/cart/quote` | Validate the cart and selected address; return current item prices, addon prices, and delivery fee for review. |

## 12. Checkout and Customer Orders

**Rules**

- Customer only. Reject empty carts, invalid addresses, closed restaurants, restaurants without Active activation status, and unavailable choices. Customers may choose a saved address or provide a one-time delivery address without saving it.
- Require `checkout_key`. Reuse the same key for retries of the same attempt and return its existing order before checking the now-cleared cart.
- Recheck prices against the reviewed quote. Return changed prices for review before creating an order; never trust client prices as the actual prices.
- Create the order, item/addon snapshots, and total, then clear the cart in one transaction.
- Customers may access only their own orders. History shows final states; active orders show the other states.
- Allow customer cancellation only while `Pending`; lock/check the current state so it cannot race with acceptance.

| Method | Route | Purpose |
|---|---|---|
| POST | `/customer/orders` | Checkout the cart using the address, reviewed prices, optional notes, and checkout key. |
| GET | `/customer/orders` | List own orders; filter by active/history or status. |
| GET | `/customer/orders/{order_id}` | Read an owned order with saved items, addons, address, total, and current status. |
| POST | `/customer/orders/{order_id}/cancel` | Cancel an owned Pending order. |

## 13. Restaurant Order Handling

**Rules**

- Restaurant only; access orders for its own restaurant.
- Accept or reject only `Pending` orders. Acceptance also assigns the delivery company automatically in the same transaction; apply Feature 14 rules.
- All status changes must check the current state inside a transaction.
- Do not edit customer choices or saved prices after checkout.

| Method | Route | Purpose |
|---|---|---|
| GET | `/restaurant/orders` | List restaurant orders; filter by status or date. |
| GET | `/restaurant/orders/{order_id}` | Read order details for preparation. |
| POST | `/restaurant/orders/{order_id}/accept` | Change Pending to Accepted and automatically assign the delivery company in one transaction. |
| POST | `/restaurant/orders/{order_id}/reject` | Change Pending to Rejected. |

## 14. Order Assignment and Delivery

**Rules**

- When the restaurant accepts a Pending order, the server automatically assigns the delivery company. Admin does not assign companies.
- For this version, use one configured `default_delivery_company_id` from app settings. Do not hard-code an ID or choose the first company in the database.
- Check that the configured company and its account exist and are active. If not, reject acceptance and keep the order Pending; return a clear error.
- Lock the order, change its status to Accepted, and save `company_id` in one transaction. Leave `driver_id` NULL until the assigned company selects an active driver.
- Retrying acceptance of an already Accepted order returns its current result without changing the company. Reject acceptance from any other state.
- When more companies are added, replace the company-selection rule with routing rules. Keep the same accept API and preserve the company already saved on existing orders.
- Driver and company must match. Only the assigned company may report pickup or delivery; drivers have no login.
- `Accepted → Picked_Up` requires a company and driver. `Picked_Up → Delivered` completes delivery.
- Admin may mark an Accepted or Picked_Up order as Failed. Final states cannot be changed.
- For the first version, do not reassign an order to another company after company assignment. A company may change its driver before pickup.
- Lock the order for assignment and status changes. No generic client-controlled status update route.

| Method | Route | Purpose |
|---|---|---|
| GET | `/admin/orders` | Monitor orders across restaurants and delivery companies. |
| GET | `/admin/orders/{order_id}` | Read an order for support and monitoring. |
| POST | `/admin/orders/{order_id}/fail` | Mark an eligible order as Failed. |
| GET | `/delivery-company/orders` | List orders assigned to the company. |
| GET | `/delivery-company/orders/{order_id}` | Read assigned order details, pickup location, and delivery address. |
| PUT | `/delivery-company/orders/{order_id}/driver` | Assign or change an owned active driver before pickup. |
| POST | `/delivery-company/orders/{order_id}/pickup` | Mark an assigned Accepted order as Picked_Up. |
| POST | `/delivery-company/orders/{order_id}/deliver` | Mark a Picked_Up order as Delivered. |

## Start Here

- Implement Feature 01 first, then continue in order.
- For each feature: build its routes, role/ownership checks, validation, and database rules; verify its main success and failure cases before moving on.
- Choose quote validation storage during implementation. Auth settings and setup are documented in `docs/AUTH.md`. Auth uses `Auth_Challenges` and `Auth_Sessions` from the database design; rate limits may also use a cache.
