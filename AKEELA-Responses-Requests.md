# AKEELA — Requests and Responses

Implemented API contracts, in the same order as `AKEELA-Features.md`. All routes start with `/api/v1`.

## Format and Headers

| Item | Format |
|---|---|
| JSON body | `Content-Type: application/json` |
| Protected routes | `Authorization: Bearer <access_token>` |
| Refresh | Refresh token in the JSON body; no access token needed. |
| Path values | Replace `{user_id}`, `{rest_id}`, and other placeholders with the record ID. |
| GET / DELETE | No request body. Query examples appear separately in the tables. |
| PATCH | Examples show editable fields; send only fields to change. |
| Identifiers | BIGINT IDs are decimal strings, such as `"200"`; use UUID strings for sessions. |
| Money | Decimal strings, such as `"100.00"`. |
| Coordinates | Decimal strings, such as `"32.2723000"`. |
| Timestamps | Africa/Cairo ISO 8601 with +02:00/+03:00; input timestamps require Z or an explicit offset. Restaurant hours use local `HH:mm:ss`. |
| Phone | API field `phone` maps to `Users.phone_number`. |
| Response column | HTTP status plus the name of the `data` model shown below. |

### Success response

```json
{
  "success": true,
  "message": "Request completed.",
  "data": {}
}
```

`Message` means `data: null` with a short message. `List<Model>` uses the following shape, with model objects inside `data`:

```json
{
  "success": true,
  "message": "Records returned.",
  "data": [],
  "meta": {
    "page": 1,
    "per_page": 20,
    "total": 0,
    "last_page": 1
  }
}
```

### Error response

```json
{
  "success": false,
  "message": "Please check the input.",
  "error": {
    "code": "VALIDATION_ERROR",
    "fields": {
      "email": [
        "Enter a valid email address."
      ]
    }
  }
}
```

| HTTP | Example code | Meaning |
|---|---|---|
| 400 | `OTP_INVALID_OR_EXPIRED` | Code is wrong, used, expired, or locked after too many attempts. |
| 401 | `UNAUTHENTICATED` | Missing, invalid, expired, or revoked credentials. |
| 403 | `EMAIL_NOT_VERIFIED` / `FORBIDDEN` | Unverified email, inactive account, or missing role access. |
| 403 | `DELIVERY_COMPANY_INACTIVE` | Company service is inactive. |
| 403 | `RESTAURANT_NOT_ACTIVE` | Restaurant activation is Pending or Suspended; management is blocked. |
| 404 | `NOT_FOUND` | Missing or inaccessible record. |
| 409 | `CONFLICT` | Duplicate email/phone/title or invalid order state. |
| 409 | `CART_RESTAURANT_CONFLICT` | Cart belongs to another restaurant. |
| 409 | `CART_CONFLICT` | Concurrent cart changes could not be completed; refresh and retry. |
| 409 | `EMPTY_CART` | Add items before quote or checkout. |
| 409 | `UNAVAILABLE` | A restaurant, item, category, addon, or link is unavailable. |
| 409 | `RESTAURANT_CLOSED` | The restaurant is closed at the current local time. |
| 409 | `ORDER_CONFLICT` | Concurrent order changes could not finish; refresh and retry. |
| 409 | `DRIVER_REQUIRED` / `DRIVER_UNAVAILABLE` | Assign or reactivate an owned driver before proceeding. |
| 409 | `DELIVERY_COMPANY_UNAVAILABLE` | Automatic assignment failed; order remains Pending. |
| 422 | `VALIDATION_ERROR` | Invalid request fields. |
| 429 | `RATE_LIMITED` | Too many attempts; response includes a `Retry-After` header. |

## 01. Authentication and My Profile

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| POST | `/auth/register` | Create an unverified customer with full name, email, password, and phone; send an email OTP. | Body: `{"full_name":"Ahmed Ali","email":"ahmed@example.com","password":"ExamplePassword!2026","phone":"+201000000001"}` | `201` · UnverifiedUser |
| POST | `/auth/register/restaurant` | Create an unverified restaurant owner and Pending restaurant profile; send an email OTP. | Body: `{"full_name":"Restaurant Owner","email":"owner@example.com","password":"ExamplePassword!2026","phone":"+201000000010","profile":{"rest_title":"AKEELA Kitchen","rest_description":"Grilled meals","rest_image_url_mobile":"https://example.com/restaurant.jpg","rest_address":"12 Main Street, Ismailia","longitude":"32.2723000","latitude":"30.5965000","opens_at":"10:00:00","closes_at":"02:00:00"}}` | `201` · UnverifiedRestaurantUser |
| POST | `/auth/verify-email` | Verify `email` and `otp`, then set `email_verified_at`. The user can log in afterward. | Body: `{"email":"ahmed@example.com","otp":"123456"}` | `200` · Message |
| POST | `/auth/resend-verification` | Send a new email-verification OTP, subject to cooldown and limits. | Body: `{"email":"ahmed@example.com"}` | `200` · Message |
| POST | `/auth/login` | Check email and password; issue tokens only for an active, verified account. | Body: `{"email":"ahmed@example.com","password":"ExamplePassword!2026"}` | `200` · Login |
| POST | `/auth/refresh` | Rotate a valid refresh token and issue a new JWT access token. | Body: `{"refresh_token":"<random-refresh-token>"}` | `200` · Tokens |
| POST | `/auth/logout` | Revoke the current login session and its refresh token. | No body | `200` · Message |
| POST | `/auth/forgot-password` | Request a password-reset OTP by email. | Body: `{"email":"ahmed@example.com"}` | `200` · Message |
| POST | `/auth/reset-password` | Check email and reset OTP, save the new password hash, consume the code, and revoke all sessions. | Body: `{"email":"ahmed@example.com","otp":"123456","new_password":"NewExamplePassword!2026"}` | `200` · Message |
| GET | `/me` | Return shared account data and the matching role profile. | No body | `200` · User |
| PATCH | `/me` | Update allowed profile fields, including full name, phone, and customer avatar. | Body: `{"full_name":"Ahmed Ali","phone":"+201000000001","cus_avatar_url":"https://example.com/avatar.jpg"}` | `200` · User |
| PATCH | `/me/password` | Check the current password, save the new password hash, and revoke all sessions. | Body: `{"current_password":"ExamplePassword!2026","new_password":"NewExamplePassword!2026"}` | `200` · Message |

Customer and restaurant registration return unverified accounts without tokens. Restaurant registration also returns a Pending profile; after email verification the owner may log in to view activation status, while management stays blocked until Admin activation. Verify-email returns `Message`; login then returns `Login`. Forgot-password and resend use: `"If this account is eligible, an email has been sent."` Password change/reset returns a message and requires login again. Approved defaults are access JWT 900 seconds, refresh session 2592000 seconds, and OTP 600 seconds with 5 attempts and 60-second resend cooldown. Remaining refresh lifetime may be lower in responses. Passwords are 8–128 characters with at least one letter and one digit; phone is in international + format.

## 02. Admin — Accounts

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/admin/users` | List accounts; filter by role or activity. | Query: `page=1&per_page=20&role=Restaurant&is_active=true` | `200` · List<User> |
| GET | `/admin/users/{user_id}` | Read an account and its profile. | No body | `200` · User |
| POST | `/admin/users` | Create a Delivery_Company account and profile. | Body: `{"full_name":"Company Owner","email":"company@example.com","password":"ExamplePassword!2026","phone":"+201000000020","role":"Delivery_Company","profile":{"company_name":"Local Delivery","company_phone":"+201000000020","company_email":"office@example.com","company_address":"5 Main Street, Ismailia","is_active":true}}` | `201` · User |
| PATCH | `/admin/users/{user_id}/activity` | Enable or disable login for an account. | Body: `{"is_active":false}` | `200` · User |
| GET | `/admin/restaurants` | List restaurant owners and profiles; filter by activation status for review. | Query: `page=1&per_page=20&activation_status=Pending` | `200` · List<RestaurantReview> |
| PATCH | `/admin/restaurants/{rest_id}/activation` | Activate, suspend, or reactivate a restaurant. | Body: `{"activation_status":"Active"}` | `200` · RestaurantProfile (also includes `user_id` and `profile_role`) |

Create-user accepts a Delivery_Company account with one nested profile object, as shown above. Creating an Admin through this API returns `409 CONFLICT`; the only Admin is created through the CLI.

## 03. Customer Addresses

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/customer/addresses` | List saved addresses. | No body | `200` · List<Address> |
| POST | `/customer/addresses` | Save an address. | Body: `{"address_title":"Home","address_line":"8 Main Street, floor 2","longitude":"32.2800000","latitude":"30.6000000","is_default":true}` | `201` · Address |
| PATCH | `/customer/addresses/{address_id}` | Update an owned address. | Body: `{"address_title":"Work","address_line":"9 Main Street","longitude":"32.2810000","latitude":"30.6010000"}` | `200` · Address |
| PUT | `/customer/addresses/{address_id}/default` | Make an owned address the default. | No body | `200` · Address |
| DELETE | `/customer/addresses/{address_id}` | Remove an owned saved address. | No body | `200` · Message |

Customers may save at most 2 addresses. Attempting to create a third address returns `409` · `CONFLICT` (`Customers can save at most 2 addresses.`). At checkout, customers may select a saved address or specify a one-time delivery address and coordinates without saving it into customer addresses.

## 04. Restaurant Profile

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/profile` | Read the restaurant's own profile, including activation status. | No body | `200` · RestaurantProfile |
| GET | `/restaurant/dashboard` | Read account activation status and whether restaurant management is allowed. | No body | `200` · RestaurantDashboard |
| PATCH | `/restaurant/profile` | Update restaurant details and service activity. | Body: `{"rest_title":"AKEELA Kitchen","rest_description":"Grilled meals","rest_image_url_mobile":"https://example.com/restaurant.jpg","rest_address":"12 Main Street, Ismailia","longitude":"32.2723000","latitude":"30.5965000","opens_at":"10:00:00","closes_at":"02:00:00","is_active":true}` | `200` · RestaurantProfile |

`RestaurantDashboard` shows `Pending`, `Active`, or `Suspended`. `can_manage` is true only when activation is Active and the owner account is active and email-verified. A tailored status message is provided (`Your restaurant is waiting for Admin activation.`, `Your restaurant is suspended by Admin.`, or `Your restaurant is active and ready to manage.`). Owners can read account/profile/dashboard while Pending or Suspended. Restaurant profile/shared account edits, catalog and order operations return `403 RESTAURANT_NOT_ACTIVE` until Active. Admin activation accepts `Active` or `Suspended`; registration returns `Pending`.

## 05. Categories

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/categories` | List owned categories, including inactive ones and product counts. | Query: `page=1&per_page=20` | `200` · List<Category> |
| POST | `/restaurant/categories` | Create a menu category with automatic sequential display order. | Body: `{"cat_title":"Sandwiches","is_active":true}` | `201` · Category |
| PATCH | `/restaurant/categories/{cat_id}` | Update title, activity, or swap display order with an existing category. | Body: `{"cat_title":"Sandwiches","display_order":1,"is_active":true}` | `200` · Category |
| DELETE | `/restaurant/categories/{cat_id}` | Delete an empty owned category and compact display orders. | No body | `200` · Message |

## 06. Products

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/products` | List owned products; optionally filter by category or unlinked status. | Query: `page=1&per_page=20&cat_id=100&unlinked=false` | `200` · List<Product> |
| GET | `/restaurant/products/{prod_id}` | Read product details for editing. | No body | `200` · Product |
| POST | `/restaurant/products` | Create a product in an owned category or as an unlinked inactive product. | Body: `{"cat_id":"100","prod_name":"Burger","prod_description":"Grilled beef burger","prod_image_url":"https://example.com/burger.jpg","price":"100.00","is_active":true}` | `201` · Product |
| PATCH | `/restaurant/products/{prod_id}` | Update product details, price, category link (or unlink with null), or activity. | Body: `{"cat_id":"100","prod_name":"Burger","prod_description":"Grilled beef burger","prod_image_url":"https://example.com/burger.jpg","price":"100.00","is_active":true}` | `200` · Product |
| DELETE | `/restaurant/products/{prod_id}` | Permanently delete an unlinked owned product. | No body | `200` · Message |

## 07. Addons and Product Links

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/addons` | List owned addons; optionally filter by unlinked status. | Query: `page=1&per_page=20&unlinked=false` | `200` · List<Addon> |
| POST | `/restaurant/addons` | Create an unlinked inactive addon and its price. | Body: `{"addon_name":"Cheese","addon_price":"10.00"}` | `201` · Addon |
| PATCH | `/restaurant/addons/{addon_id}` | Update addon name, price, or activity (when linked). | Body: `{"addon_name":"Cheese","addon_price":"10.00","is_active":true}` | `200` · Addon |
| GET | `/restaurant/products/{prod_id}/addons` | List the product's addon links, including inactive links. | No body | `200` · List<ProductAddon> |
| PUT | `/restaurant/products/{prod_id}/addons/{addon_id}` | Create a link or enable/disable an existing link. | Body: `{"is_active":true}` | `200` · ProductAddon |
| DELETE | `/restaurant/addons/{addon_id}` | Permanently delete an unlinked owned addon. | No body | `200` · Message |

Product-addon PUT returns `200` for both a new link and an update. Linking an unlinked addon to its first product auto-activates the addon; unlinking its last active product auto-deactivates it.

## 08. Offers

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/offers` | List owned offers, including inactive and expired ones. | Query: `page=1&per_page=20` | `200` · List<Offer> |
| POST | `/restaurant/offers` | Create an offer. | Body: `{"offer_title":"Lunch Offer","offer_description":"Lunch meal","initial_price":"150.00","real_price":"130.00","offer_image_url":null,"is_active":true,"starts_at":"2026-11-12T02:00:00.000+02:00","expires_at":"2026-12-01T02:00:00.000+02:00"}` | `201` · Offer |
| PATCH | `/restaurant/offers/{offer_id}` | Update offer details, prices, dates, or activity. | Body: `{"offer_title":"Lunch Offer","offer_description":"Lunch meal","initial_price":"150.00","real_price":"130.00","offer_image_url":null,"is_active":true,"starts_at":"2026-11-12T02:00:00.000+02:00","expires_at":"2026-12-01T02:00:00.000+02:00"}` | `200` · Offer |

## 09. Public Restaurant Menu

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurants` | Browse active restaurants. | Query: `page=1&per_page=20` | `200` · List<PublicRestaurant> |
| GET | `/restaurants/{rest_id}` | Read public restaurant details and opening hours. | No body | `200` · PublicRestaurant |
| GET | `/restaurants/{rest_id}/categories` | Read categories in display order. | Query: `page=1&per_page=20` | `200` · List<PublicCategory> |
| GET | `/restaurants/{rest_id}/products` | Browse products; optionally filter by category. | Query: `page=1&per_page=20&cat_id=100` | `200` · List<PublicProduct> |
| GET | `/restaurants/{rest_id}/products/{prod_id}` | Read a product and its allowed active addons. | No body | `200` · PublicProductDetails |
| GET | `/restaurants/{rest_id}/offers` | Browse offers available for sale. | Query: `page=1&per_page=20` | `200` · List<PublicOffer> |
| GET | `/restaurants/{rest_id}/offers/{offer_id}` | Read an available offer. | No body | `200` · PublicOffer |

## 10. Delivery Company and Drivers

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/delivery-company/profile` | Read the company's own profile. | No body | `200` · CompanyProfile |
| PATCH | `/delivery-company/profile` | Update company contact details and service activity. | Body: `{"company_name":"Local Delivery","company_phone":"+201000000020","company_email":"office@example.com","company_address":"5 Main Street, Ismailia","is_active":true}` | `200` · CompanyProfile |
| GET | `/delivery-company/drivers` | List the company's drivers. | Query: `page=1&per_page=20&is_active=true` | `200` · List<Driver> |
| POST | `/delivery-company/drivers` | Add a driver to the company. | Body: `{"driver_name":"Omar Hassan","driver_phone":"+201000000030","driver_email":null,"is_active":true}` | `201` · Driver |
| PATCH | `/delivery-company/drivers/{driver_id}` | Update driver details or activity. | Body: `{"driver_name":"Omar Hassan","is_active":false}` | `200` · Driver |

In the single-company version, company creation/profile updates with `is_active=false` and disabling Delivery_Company login accounts return `409 CONFLICT`. Driver activity remains editable.

## 11. Customer Cart

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/customer/cart` | Read the cart, selected addons, and current calculated prices. Return an empty cart if none exists. | No body | `200` · Cart or EmptyCart |
| POST | `/customer/cart/items` | Add a product or offer, quantity, and chosen addons; create the cart if needed. | Body: `{"rest_id":"10","prod_id":"200","offer_id":null,"quantity":2,"addons":[{"addon_id":"300","quantity":2}]}` | `201` · Cart |
| PATCH | `/customer/cart/items/{cart_item_id}` | Update quantity and addon choices for an owned item. | Body: `{"quantity":2,"addons":[{"addon_id":"300","quantity":2}]}` | `200` · Cart |
| DELETE | `/customer/cart/items/{cart_item_id}` | Remove an item and its selected addons. | No body | `200` · Cart or EmptyCart |
| DELETE | `/customer/cart` | Clear the cart and its items. | No body | `200` · EmptyCart |
| POST | `/customer/cart/quote` | Validate the cart and selected address; return current item prices, addon prices, and delivery fee for review. | Body: `{"address_id":"50"}` | `200` · Quote |

Offer item body example:

```json
{
  "rest_id": "10",
  "prod_id": null,
  "offer_id": "400",
  "quantity": 1,
  "addons": []
}
```

Adding matching product/addon choices combines quantities only when the per-product addon ratio matches; different ratios remain separate rows. Switching restaurants returns `409 CART_RESTAURANT_CONFLICT`; explicitly clear the cart first. There are no business limits on cart size or quantity beyond storage type ranges and money overflow checks.

For PATCH, `addons` is the full replacement selection when supplied; `[]` clears it. An omitted selection stays unchanged; when quantity changes, send the intended total addon quantities too. DELETE cart returns `EmptyCart`; deleting its last item may return a cart with no items. `is_available` in cart responses is calculated, not a new database field.

Quote and checkout accept exactly one of `address_id` (an owned saved address) or `delivery_address` (a one-time address with `address_line`, `longitude`, and `latitude`). One-time addresses are saved only as order snapshots, not in Customer_Addresses. Currency is EGP and the initial general delivery fee is `"30.00"`.

## 12. Checkout and Customer Orders

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| POST | `/customer/orders` | Checkout the cart using the address, current server prices, and optional notes. | Body: `{"address_id":"50","notes":"Call on arrival"}` | `201` · Order |
| GET | `/customer/orders` | List own orders; filter by active/history or status. | Query: `page=1&per_page=20&scope=history&status=Delivered` | `200` · List<OrderSummary> |
| GET | `/customer/orders/{order_id}` | Read an owned order with saved items, addons, address, total, and current status. | No body | `200` · Order |
| POST | `/customer/orders/{order_id}/cancel` | Cancel an owned Pending order. | No body | `200` · OrderState |

Checkout calculates current server prices and creates a Pending order directly. No quote token, reviewed-total comparison, checkout key, or request hash is accepted. The quote endpoint is informational, with no expiry or price reservation. List query parameters are optional; `scope` is `active` or `history`. Notes may contain up to 10,000 characters.

## 13. Restaurant Order Handling

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/orders` | List restaurant orders; filter by status or date. | Query: `page=1&per_page=20&status=Accepted&date_from=2026-11-01&date_to=2026-11-30` | `200` · List<OrderSummary> |
| GET | `/restaurant/orders/{order_id}` | Read order details for preparation. | No body | `200` · Order |
| POST | `/restaurant/orders/{order_id}/accept` | Change Pending to Accepted and automatically assign the delivery company in one transaction. | No body | `200` · OrderState |
| POST | `/restaurant/orders/{order_id}/reject` | Change Pending to Rejected. | No body | `200` · OrderState |
| GET | `/restaurant/analytics` | Return restaurant-scoped revenue, order quality, repeat-customer, peak-hour, menu-performance, category, addon, and live alert analytics. | Query: `range=30d` | `200` · RestaurantAnalytics |

## 14. Order Assignment and Delivery

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/admin/orders` | Monitor orders across restaurants and delivery companies. | Query: `page=1&per_page=20&status=Accepted&date_from=2026-11-01&date_to=2026-11-30` | `200` · List<OrderSummary> |
| GET | `/admin/orders/{order_id}` | Read an order for support and monitoring. | No body | `200` · Order |
| POST | `/admin/orders/{order_id}/fail` | Mark an eligible order as Failed. | No body | `200` · OrderState |
| GET | `/delivery-company/orders` | List orders assigned to the company. | Query: `page=1&per_page=20&status=Accepted&date_from=2026-11-01&date_to=2026-11-30` | `200` · List<OrderSummary> |
| GET | `/delivery-company/orders/{order_id}` | Read assigned order details, pickup location, and delivery address. | No body | `200` · DeliveryOrder |
| PUT | `/delivery-company/orders/{order_id}/driver` | Assign or reassign an owned active driver while Accepted or Picked_Up (transitions Accepted to Picked_Up). | Body: `{"driver_id":"30"}` | `200` · OrderState |
| POST | `/delivery-company/orders/{order_id}/pickup` | Confirm pickup of an assigned Accepted or Picked_Up order (idempotent). | No body | `200` · OrderState |
| POST | `/delivery-company/orders/{order_id}/deliver` | Mark a Picked_Up order as Delivered. | No body | `200` · OrderState |
| GET | `/admin/orders/counts` | Return order counts grouped by status across the platform. | No body | `200` · OrderStatusCounts |
| GET | `/delivery-company/orders/counts` | Return assigned order counts grouped by status for the company. | No body | `200` · OrderStatusCounts |
| GET | `/admin/analytics` | Return platform KPIs, trends, peak hours, restaurant rankings, top items, alerts, and totals. | Query: `range=30d` | `200` · AdminAnalytics |
| GET | `/delivery-company/analytics` | Return company-scoped dispatch KPIs, live queue alerts, fleet utilization, driver leaderboard, trends, peak hours, and top pickup restaurants. | Query: `range=30d` | `200` · DeliveryAnalytics |
| GET | `/admin/restaurants/{rest_id}/analytics` | Return restaurant-scoped earnings, daily series, order quality, peak hours, and menu analytics for Admin review. | Query: `range=30d` or `date_from=2026-11-01&date_to=2026-11-30` | `200` · RestaurantAnalytics |

List date filters use valid `YYYY-MM-DD` dates in Africa/Cairo. Both bounds include their whole local day; `date_from` must not follow `date_to`. Delivery pickup details use the current restaurant address/coordinates; the customer delivery address and prices remain order snapshots. Acceptance retries from Accepted and pickup retries from Picked_Up are idempotent; other invalid/final-state transitions return `409 CONFLICT`.

Order action response values:

| Action | status | company_id | driver_id |
|---|---|---|---|
| Customer cancel | Cancelled | null | null |
| Restaurant reject | Rejected | null | null |
| Restaurant accept | Accepted | Automatically selected company ID | null |
| Company driver assignment | Picked_Up | Assigned company ID | Selected driver ID |
| Company pickup | Picked_Up | Assigned company ID | Assigned driver ID |
| Company delivery | Delivered | Assigned company ID | Assigned driver ID |
| Admin fail | Failed | Existing company ID | Existing driver ID or null |

## Response Data Examples

The JSON blocks below are the `data` value inside the success envelope. Repeated timestamps and sample IDs show the field types. Examples are independent; PATCH responses contain the actual updated values.

### User

```json
{
  "user_id": "1",
  "full_name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "phone": "+201000000001",
  "role": "Customer",
  "is_active": true,
  "email_verified_at": "2026-11-12T12:00:00.000+02:00",
  "profile": {
    "user_id": "1",
    "profile_role": "Customer",
    "cus_avatar_url": null,
    "created_at": "2026-11-12T12:00:00.000+02:00",
    "updated_at": "2026-11-12T12:00:00.000+02:00"
  },
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

For Restaurant users, `profile` contains `RestaurantProfile` plus `user_id` and `profile_role`. Delivery_Company uses `CompanyProfile` plus those fields. Admin uses `user_id`, `profile_role`, `created_at`, and `updated_at`. Admin list/detail uses the same account shape. Admin create returns `email_verified_at: null`.

### UnverifiedUser

```json
{
  "user_id": "1",
  "full_name": "Ahmed Ali",
  "email": "ahmed@example.com",
  "phone": "+201000000001",
  "role": "Customer",
  "is_active": true,
  "email_verified_at": null,
  "profile": {
    "user_id": "1",
    "profile_role": "Customer",
    "cus_avatar_url": null,
    "created_at": "2026-11-12T12:00:00.000+02:00",
    "updated_at": "2026-11-12T12:00:00.000+02:00"
  },
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### Tokens

```json
{
  "token_type": "Bearer",
  "access_token": "<jwt-access-token>",
  "expires_in": 900,
  "refresh_token": "<random-refresh-token>",
  "refresh_expires_in": 2592000
}
```

### Login

```json
{
  "user": {
    "user_id": "1",
    "full_name": "Ahmed Ali",
    "email": "ahmed@example.com",
    "phone": "+201000000001",
    "role": "Customer",
    "is_active": true,
    "email_verified_at": "2026-11-12T12:00:00.000+02:00",
    "profile": {
      "user_id": "1",
      "profile_role": "Customer",
      "cus_avatar_url": null,
      "created_at": "2026-11-12T12:00:00.000+02:00",
      "updated_at": "2026-11-12T12:00:00.000+02:00"
    },
    "created_at": "2026-11-12T12:00:00.000+02:00",
    "updated_at": "2026-11-12T12:00:00.000+02:00"
  },
  "tokens": {
    "token_type": "Bearer",
    "access_token": "<jwt-access-token>",
    "expires_in": 900,
    "refresh_token": "<random-refresh-token>",
    "refresh_expires_in": 2592000
  }
}
```

### Address

```json
{
  "address_id": "50",
  "user_id": "1",
  "address_title": "Home",
  "address_line": "8 Main Street, floor 2",
  "longitude": "32.2800000",
  "latitude": "30.6000000",
  "is_default": true,
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### RestaurantProfile

```json
{
  "rest_id": "10",
  "rest_title": "AKEELA Kitchen",
  "rest_description": "Grilled meals",
  "rest_image_url_mobile": "https://example.com/restaurant.jpg",
  "rest_address": "12 Main Street, Ismailia",
  "longitude": "32.2723000",
  "latitude": "30.5965000",
  "opens_at": "10:00:00",
  "closes_at": "02:00:00",
  "is_active": true,
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00",
  "activation_status": "Active"
}
```

### CompanyProfile

```json
{
  "company_id": "20",
  "company_name": "Local Delivery",
  "user_id": "20",
  "company_phone": "+201000000020",
  "company_email": "office@example.com",
  "company_address": "5 Main Street, Ismailia",
  "is_active": true,
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### Category

```json
{
  "cat_id": "100",
  "rest_id": "10",
  "cat_title": "Sandwiches",
  "display_order": 1,
  "is_active": true,
  "product_count": 2,
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### Product

```json
{
  "prod_id": "200",
  "rest_id": "10",
  "cat_id": "100",
  "prod_name": "Burger",
  "prod_description": "Grilled beef burger",
  "prod_image_url": "https://example.com/burger.jpg",
  "price": "100.00",
  "is_active": true,
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### Addon

```json
{
  "addon_id": "300",
  "rest_id": "10",
  "addon_name": "Cheese",
  "addon_price": "10.00",
  "is_active": true,
  "linked_product_ids": ["200"],
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### ProductAddon

```json
{
  "rest_id": "10",
  "prod_id": "200",
  "addon_id": "300",
  "is_active": true,
  "addon": {
    "addon_id": "300",
    "rest_id": "10",
    "addon_name": "Cheese",
    "addon_price": "10.00",
    "is_active": true,
    "linked_product_ids": ["200"],
    "created_at": "2026-11-12T12:00:00.000+02:00",
    "updated_at": "2026-11-12T12:00:00.000+02:00"
  },
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### Offer

```json
{
  "offer_id": "400",
  "rest_id": "10",
  "offer_title": "Lunch Offer",
  "offer_description": "Lunch meal",
  "initial_price": "150.00",
  "real_price": "130.00",
  "offer_image_url": null,
  "is_active": true,
  "starts_at": "2026-11-12T02:00:00.000+02:00",
  "expires_at": "2026-12-01T02:00:00.000+02:00",
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### Driver

```json
{
  "driver_id": "30",
  "company_id": "20",
  "driver_name": "Omar Hassan",
  "driver_phone": "+201000000030",
  "driver_email": null,
  "is_active": true,
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### PublicRestaurant

```json
{
  "rest_id": "10",
  "rest_title": "AKEELA Kitchen",
  "rest_description": "Grilled meals",
  "rest_image_url_mobile": "https://example.com/restaurant.jpg",
  "rest_address": "12 Main Street, Ismailia",
  "longitude": "32.2723000",
  "latitude": "30.5965000",
  "opens_at": "10:00:00",
  "closes_at": "02:00:00",
  "is_open": true
}
```

### PublicCategory

```json
{
  "cat_id": "100",
  "cat_title": "Sandwiches",
  "display_order": 0
}
```

### PublicProduct

```json
{
  "prod_id": "200",
  "cat_id": "100",
  "prod_name": "Burger",
  "prod_description": "Grilled beef burger",
  "prod_image_url": "https://example.com/burger.jpg",
  "price": "100.00"
}
```

### PublicOffer

```json
{
  "offer_id": "400",
  "rest_id": "10",
  "offer_title": "Lunch Offer",
  "offer_description": "Lunch meal",
  "initial_price": "150.00",
  "real_price": "130.00",
  "offer_image_url": null,
  "starts_at": "2026-11-12T02:00:00.000+02:00",
  "expires_at": "2026-12-01T02:00:00.000+02:00"
}
```

### Cart

```json
{
  "cart_id": "70",
  "rest_id": "10",
  "items": [
    {
      "cart_item_id": "60",
      "prod_id": "200",
      "offer_id": null,
      "item_name": "Burger",
      "quantity": 2,
      "unit_price": "100.00",
      "subtotal": "200.00",
      "addons": [
        {
          "addon_id": "300",
          "addon_name": "Cheese",
          "quantity": 2,
          "unit_price": "10.00",
          "subtotal": "20.00"
        }
      ],
      "line_total": "220.00",
      "is_available": true
    }
  ],
  "items_subtotal": "200.00",
  "addons_subtotal": "20.00",
  "subtotal": "220.00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

Item `subtotal` excludes addons. `line_total` includes them. Cart `subtotal` excludes the delivery fee. Names, prices, availability, and totals here are calculated from current catalog data.

### EmptyCart

```json
{
  "cart_id": null,
  "rest_id": null,
  "items": [],
  "items_subtotal": "0.00",
  "addons_subtotal": "0.00",
  "subtotal": "0.00",
  "updated_at": null
}
```

### Quote

```json
{
  "address_id": "50",
  "delivery_address": {"address_line":"8 Main Street, floor 2","longitude":"32.2800000","latitude":"30.6000000"},
  "cart": {
    "cart_id": "70",
    "rest_id": "10",
    "items": [
      {
        "cart_item_id": "60",
        "prod_id": "200",
        "offer_id": null,
        "item_name": "Burger",
        "quantity": 2,
        "unit_price": "100.00",
        "subtotal": "200.00",
        "addons": [
          {
            "addon_id": "300",
            "addon_name": "Cheese",
            "quantity": 2,
            "unit_price": "10.00",
            "subtotal": "20.00"
          }
        ],
        "line_total": "220.00",
        "is_available": true
      }
    ],
    "items_subtotal": "200.00",
    "addons_subtotal": "20.00",
    "subtotal": "220.00",
    "updated_at": "2026-11-12T12:00:00.000+02:00"
  },
  "delivery_fee": "30.00",
  "total_price": "250.00"
}
```

### OrderSummary

```json
{
  "order_id": "80",
  "rest_id": "10",
  "status": "Pending",
  "company_id": null,
  "driver_id": null,
  "total_price": "250.00",
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### Order

```json
{
  "order_id": "80",
  "customer_id": "1",
  "rest_id": "10",
  "company_id": null,
  "driver_id": null,
  "status": "Pending",
  "customer_address": "8 Main Street, floor 2",
  "delivery_longitude": "32.2800000",
  "delivery_latitude": "30.6000000",
  "delivery_fee": "30.00",
  "total_price": "250.00",
  "notes": "Call on arrival",
  "items": [
    {
      "order_item_id": "90",
      "prod_id": "200",
      "offer_id": null,
      "item_name": "Burger",
      "unit_price": "100.00",
      "quantity": 2,
      "subtotal": "200.00",
      "addons": [
        {
          "order_item_addon_id": "91",
          "addon_id": "300",
          "addon_name": "Cheese",
          "unit_price": "10.00",
          "quantity": 2,
          "subtotal": "20.00"
        }
      ]
    }
  ],
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

Order names, prices, address, fee, and item/addon totals are saved checkout values. Sum item subtotals and addon subtotals separately, then add the delivery fee.

### DeliveryOrder

```json
{
  "order_id": "80",
  "customer_id": "1",
  "rest_id": "10",
  "company_id": null,
  "driver_id": null,
  "status": "Pending",
  "customer_address": "8 Main Street, floor 2",
  "delivery_longitude": "32.2800000",
  "delivery_latitude": "30.6000000",
  "delivery_fee": "30.00",
  "total_price": "250.00",
  "notes": "Call on arrival",
  "items": [
    {
      "order_item_id": "90",
      "prod_id": "200",
      "offer_id": null,
      "item_name": "Burger",
      "unit_price": "100.00",
      "quantity": 2,
      "subtotal": "200.00",
      "addons": [
        {
          "order_item_addon_id": "91",
          "addon_id": "300",
          "addon_name": "Cheese",
          "unit_price": "10.00",
          "quantity": 2,
          "subtotal": "20.00"
        }
      ]
    }
  ],
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00",
  "pickup": {
    "rest_title": "AKEELA Kitchen",
    "rest_address": "12 Main Street, Ismailia",
    "longitude": "32.2723000",
    "latitude": "30.5965000"
  }
}
```

### OrderState

```json
{
  "order_id": "80",
  "status": "Accepted",
  "company_id": "20",
  "driver_id": null,
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### OrderStatusCounts

```json
{
  "Pending": 3,
  "Accepted": 2,
  "Picked_Up": 1,
  "Delivered": 14,
  "Rejected": 1,
  "Cancelled": 2,
  "Failed": 0
}
```

### AdminAnalytics

```json
{
  "range": "30d",
  "generated_at": "2026-11-19T12:00:00.000+02:00",
  "kpis": {
    "delivered_gmv": "12450.00",
    "delivery_fees_total": "1440.00",
    "avg_order_value": "259.38",
    "total_orders": 60,
    "delivered_orders": 48,
    "completion_rate": 80,
    "rejection_rate": 6.7,
    "cancellation_rate": 8.3,
    "failure_rate": 1.7,
    "new_customers": 24,
    "new_restaurants": 3
  },
  "previous_kpis": {
    "delivered_gmv": "10200.00",
    "delivery_fees_total": "1200.00",
    "avg_order_value": "255.00",
    "total_orders": 50,
    "delivered_orders": 40,
    "new_customers": 18,
    "new_restaurants": 2
  },
  "status_breakdown": {
    "Pending": 1,
    "Accepted": 1,
    "Picked_Up": 0,
    "Delivered": 48,
    "Rejected": 4,
    "Cancelled": 5,
    "Failed": 1
  },
  "daily_series": [
    {
      "date": "2026-11-19",
      "orders": 6,
      "delivered": 5,
      "gmv": "1290.00"
    }
  ],
  "peak_hours": [
    {
      "hour": 20,
      "orders": 14
    }
  ],
  "top_restaurants": [
    {
      "rest_id": "10",
      "rest_title": "AKEELA Grill",
      "total_orders": 24,
      "delivered_orders": 22,
      "rejected_orders": 1,
      "rejection_rate": 4.2,
      "gmv": "5840.00"
    }
  ],
  "attention_restaurants": [
    {
      "rest_id": "12",
      "rest_title": "Express Corner",
      "total_orders": 10,
      "delivered_orders": 7,
      "rejected_orders": 3,
      "rejection_rate": 30,
      "gmv": "1680.00"
    }
  ],
  "top_items": [
    {
      "rest_id": "10",
      "rest_title": "AKEELA Grill",
      "item_name": "Grilled Chicken Meal",
      "units_sold": 32,
      "revenue": "3200.00"
    }
  ],
  "alerts": {
    "stale_pending_orders": 1,
    "stale_accepted_orders": 0,
    "pending_restaurants": 2,
    "unverified_companies": 0
  },
  "platform_totals": {
    "total_users": 86,
    "customers": 72,
    "restaurants_total": 12,
    "restaurants_active": 9,
    "restaurants_pending": 2,
    "restaurants_suspended": 1,
    "delivery_companies": 1,
    "active_drivers": 6,
    "inactive_drivers": 1
  }
}
```

### DeliveryAnalytics

```json
{
  "range": "30d",
  "generated_at": "2026-11-19T12:00:00.000+02:00",
  "kpis": {
    "delivery_fees_earned": "1440.00",
    "avg_delivery_fee": "30.00",
    "cod_collected_value": "12450.00",
    "assigned_orders": 51,
    "delivered_orders": 48,
    "failed_orders": 1,
    "delivery_success_rate": 98,
    "failure_rate": 2,
    "avg_fulfillment_minutes": 34.5
  },
  "previous_kpis": {
    "delivery_fees_earned": "1200.00",
    "cod_collected_value": "10200.00",
    "assigned_orders": 42,
    "delivered_orders": 40,
    "failed_orders": 1,
    "avg_fulfillment_minutes": 38.2
  },
  "live_queue": {
    "unassigned_accepted": 1,
    "in_transit": 1,
    "stale_unassigned": 0,
    "long_in_transit": 0,
    "inactive_driver_orders": 0
  },
  "status_breakdown": {
    "Accepted": 1,
    "Picked_Up": 1,
    "Delivered": 48,
    "Failed": 1
  },
  "daily_series": [
    {
      "date": "2026-11-19",
      "assigned": 6,
      "delivered": 5,
      "failed": 0,
      "delivery_fees": "150.00"
    }
  ],
  "peak_hours": [
    {
      "hour": 20,
      "orders": 14
    }
  ],
  "fleet": {
    "total_drivers": 7,
    "active_drivers": 6,
    "inactive_drivers": 1,
    "busy_drivers": 1,
    "idle_active_drivers": 5
  },
  "driver_leaderboard": [
    {
      "driver_id": "30",
      "driver_name": "Ahmed Hassan",
      "driver_phone": "+201000000011",
      "is_active": true,
      "current_load": 1,
      "delivered_orders": 22,
      "failed_orders": 0,
      "delivery_fees": "660.00",
      "avg_fulfillment_minutes": 31.2,
      "success_rate": 100
    }
  ],
  "top_pickup_restaurants": [
    {
      "rest_id": "10",
      "rest_title": "AKEELA Grill",
      "assigned_orders": 24,
      "delivered_orders": 22,
      "failed_orders": 0,
      "delivery_fees": "660.00"
    }
  ]
}
```

### RestaurantAnalytics

```json
{
  "range": "30d",
  "generated_at": "2026-11-19T12:00:00.000+02:00",
  "kpis": {
    "food_revenue": "11010.00",
    "gross_gmv": "12450.00",
    "addons_revenue": "1280.00",
    "avg_order_value": "229.38",
    "total_orders": 58,
    "delivered_orders": 48,
    "rejected_orders": 3,
    "cancelled_orders": 4,
    "acceptance_rate": 94.4,
    "completion_rate": 82.8,
    "rejection_rate": 5.2,
    "cancellation_rate": 6.9,
    "unique_customers": 31,
    "repeat_customers": 12,
    "repeat_customer_rate": 38.7,
    "avg_fulfillment_minutes": 32.4
  },
  "previous_kpis": {
    "food_revenue": "9100.00",
    "addons_revenue": "980.00",
    "avg_order_value": "221.95",
    "total_orders": 49,
    "delivered_orders": 41,
    "avg_fulfillment_minutes": 35.1
  },
  "live_alerts": {
    "pending_orders": 2,
    "stale_pending_orders": 1,
    "active_in_progress": 1,
    "inactive_products": 1,
    "expiring_offers": 1
  },
  "status_breakdown": {
    "Pending": 2,
    "Accepted": 1,
    "Picked_Up": 0,
    "Delivered": 48,
    "Rejected": 3,
    "Cancelled": 4,
    "Failed": 0
  },
  "daily_series": [
    {
      "date": "2026-11-19",
      "orders": 6,
      "delivered": 5,
      "food_revenue": "1140.00"
    }
  ],
  "peak_hours": [
    {
      "hour": 20,
      "orders": 14
    }
  ],
  "menu_totals": {
    "active_categories": 4,
    "active_products": 14,
    "inactive_products": 1,
    "active_addons": 6,
    "active_offers": 2
  },
  "top_items": [
    {
      "item_name": "Grilled Chicken Meal",
      "item_type": "product",
      "units_sold": 32,
      "revenue": "3200.00",
      "share_pct": 32.9
    }
  ],
  "slow_items": [
    {
      "prod_id": "204",
      "prod_name": "Fresh Lemonade",
      "cat_title": "Drinks",
      "price": "35.00",
      "units_sold": 0
    }
  ],
  "top_addons": [
    {
      "addon_name": "Extra Cheddar",
      "units_sold": 26,
      "revenue": "650.00"
    }
  ],
  "category_breakdown": [
    {
      "cat_title": "Grills",
      "units_sold": 45,
      "revenue": "5400.00",
      "share_pct": 55.5
    }
  ]
}
```

### PublicProductDetails

```json
{
  "prod_id": "200",
  "cat_id": "100",
  "prod_name": "Burger",
  "prod_description": "Grilled beef burger",
  "prod_image_url": "https://example.com/burger.jpg",
  "price": "100.00",
  "addons": [
    {
      "addon_id": "300",
      "addon_name": "Cheese",
      "addon_price": "10.00"
    }
  ]
}
```

### UnverifiedRestaurantUser

```json
{
  "user_id": "10",
  "full_name": "Restaurant Owner",
  "email": "owner@example.com",
  "phone": "+201000000010",
  "role": "Restaurant",
  "is_active": true,
  "email_verified_at": null,
  "profile": {
    "rest_id": "10",
    "rest_title": "AKEELA Kitchen",
    "rest_description": "Grilled meals",
    "rest_image_url_mobile": "https://example.com/restaurant.jpg",
    "rest_address": "12 Main Street, Ismailia",
    "longitude": "32.2723000",
    "latitude": "30.5965000",
    "opens_at": "10:00:00",
    "closes_at": "02:00:00",
    "is_active": true,
    "created_at": "2026-11-12T12:00:00.000+02:00",
    "updated_at": "2026-11-12T12:00:00.000+02:00",
    "activation_status": "Pending",
    "user_id": "10",
    "profile_role": "Restaurant"
  },
  "created_at": "2026-11-12T12:00:00.000+02:00",
  "updated_at": "2026-11-12T12:00:00.000+02:00"
}
```

### RestaurantReview

```json
{
  "owner": {
    "user_id": "10",
    "full_name": "Restaurant Owner",
    "email": "owner@example.com",
    "phone": "+201000000010",
    "email_verified_at": null,
    "is_active": true
  },
  "profile": {
    "rest_id": "10",
    "rest_title": "AKEELA Kitchen",
    "rest_description": "Grilled meals",
    "rest_image_url_mobile": "https://example.com/restaurant.jpg",
    "rest_address": "12 Main Street, Ismailia",
    "longitude": "32.2723000",
    "latitude": "30.5965000",
    "opens_at": "10:00:00",
    "closes_at": "02:00:00",
    "is_active": true,
    "created_at": "2026-11-12T12:00:00.000+02:00",
    "updated_at": "2026-11-12T12:00:00.000+02:00",
    "activation_status": "Pending",
    "user_id": "10",
    "profile_role": "Restaurant"
  }
}
```

### RestaurantDashboard

```json
{
  "rest_id": "10",
  "activation_status": "Pending",
  "can_manage": false,
  "message": "Your restaurant is waiting for Admin activation."
}
```

## 15. Image Uploads

| Method | Route | Purpose | Request | Response |
|---|---|---|---|---|
| PUT | `/customer/avatar` | Upload Customer avatar. | Multipart: `file` | `200` · ImageUpload |
| PUT | `/restaurant/profile/image` | Upload restaurant image. | Multipart: `file` | `200` · ImageUpload |
| PUT | `/restaurant/products/{prod_id}/image` | Upload product image. | Multipart: `file` | `200` · ImageUpload |
| PUT | `/restaurant/offers/{offer_id}/image` | Upload offer image. | Multipart: `file` | `200` · ImageUpload |

### ImageUpload

`Content-Type: multipart/form-data`; choose one local image in the file field. Response data:

```json
{"image_url":"https://api.example.com/images/6c867039-79e4-48f2-a9cf-a1d7576955ab.webp"}
```

## 16. Health Checks

| Method | Route | Purpose | Request | Response |
|---|---|---|---|---|
| GET | `/health/live` | Process liveness. | No body/auth | `200` · Health |
| GET | `/health/ready` | Database readiness. | No body/auth | `200` · Health; `503 NOT_READY` when unavailable |

### Health

```json
{"status":"ok","checked_at":"2026-11-13T12:00:00.000+02:00"}
```

## 17. Realtime Order Notifications

Implemented with Socket.IO in the existing API process. See [realtime contract](docs/REALTIME.md) for the connection example, payload and recovery rules. No HTTP route or database table is added.

| Event | Purpose | Allowed clients |
| --- | --- | --- |
| `order.created` | Re-fetch a new order after checkout commits. | Owning Customer, Restaurant, Admin |
| `order.updated` | Re-fetch after a committed status/driver change. | Owning Customer, Restaurant, assigned Delivery_Company, Admin |

JWT goes in handshake auth.token; namespace /orders, transport websocket, path /socket.io. Payload: order_id, status, company_id, driver_id, updated_at only. Re-fetch REST on every connection/event; no replay or delivery guarantee. Expired/revoked sessions cannot receive new updates. Browser apps are integrated; mobile must add the Socket.IO client.
