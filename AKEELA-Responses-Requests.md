# AKEELA — Requests and Responses

API contract draft, in the same order as `AKEELA-Features.md`. All routes start with `/api/v1`.

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
| Timestamps | UTC ISO 8601; restaurant hours use local `HH:mm:ss`. |
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
| 403 | `RESTAURANT_NOT_ACTIVE` | Restaurant activation is Pending or Suspended; management is blocked. |
| 404 | `NOT_FOUND` | Missing or inaccessible record. |
| 409 | `CONFLICT` | Duplicate email/phone/title or invalid order state. |
| 409 | `CART_RESTAURANT_CONFLICT` | Cart belongs to another restaurant. |
| 409 | `QUOTE_CHANGED` | Cart choices or reviewed prices changed; request a fresh quote. |
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
| POST | `/admin/users` | Create a Delivery_Company or Admin account and profile. | Body: `{"full_name":"Company Owner","email":"company@example.com","password":"ExamplePassword!2026","phone":"+201000000020","role":"Delivery_Company","profile":{"company_name":"Local Delivery","company_phone":"+201000000020","company_email":"office@example.com","company_address":"5 Main Street, Ismailia","is_active":true}}` | `201` · User |
| PATCH | `/admin/users/{user_id}/activity` | Enable or disable login for an account. | Body: `{"is_active":false}` | `200` · User |
| GET | `/admin/restaurants` | List restaurant owners and profiles; filter by activation status for review. | Query: `page=1&per_page=20&activation_status=Pending` | `200` · List<RestaurantReview> |
| PATCH | `/admin/restaurants/{rest_id}/activation` | Activate, suspend, or reactivate a restaurant. | Body: `{"activation_status":"Active"}` | `200` · RestaurantProfile |

Admin create-user body variants use the same account fields with one of these `role` and `profile` values:

```json
[
  {
    "role": "Delivery_Company",
    "profile": {
      "company_name": "Local Delivery",
      "company_phone": "+201000000020",
      "company_email": "office@example.com",
      "company_address": "5 Main Street, Ismailia",
      "is_active": true
    }
  },
  {
    "role": "Admin",
    "profile": {}
  }
]
```

## 03. Customer Addresses

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/customer/addresses` | List saved addresses. | No body | `200` · List<Address> |
| POST | `/customer/addresses` | Save an address. | Body: `{"address_title":"Home","address_line":"8 Main Street, floor 2","longitude":"32.2800000","latitude":"30.6000000","is_default":true}` | `201` · Address |
| PATCH | `/customer/addresses/{address_id}` | Update an owned address. | Body: `{"address_title":"Work","address_line":"9 Main Street","longitude":"32.2810000","latitude":"30.6010000"}` | `200` · Address |
| PUT | `/customer/addresses/{address_id}/default` | Make an owned address the default. | No body | `200` · Address |
| DELETE | `/customer/addresses/{address_id}` | Remove an owned saved address. | No body | `200` · Message |

## 04. Restaurant Profile

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/profile` | Read the restaurant's own profile, including activation status. | No body | `200` · RestaurantProfile |
| GET | `/restaurant/dashboard` | Read account activation status and whether restaurant management is allowed. | No body | `200` · RestaurantDashboard |
| PATCH | `/restaurant/profile` | Update restaurant details and service activity. | Body: `{"rest_title":"AKEELA Kitchen","rest_description":"Grilled meals","rest_image_url_mobile":"https://example.com/restaurant.jpg","rest_address":"12 Main Street, Ismailia","longitude":"32.2723000","latitude":"30.5965000","opens_at":"10:00:00","closes_at":"02:00:00","is_active":true}` | `200` · RestaurantProfile |

`RestaurantDashboard` shows `Pending`, `Active`, or `Suspended`. `can_manage` is true only when activation is Active and the owner account is active and email-verified. Non-active owners can read account/profile/dashboard status but receive `403 RESTAURANT_NOT_ACTIVE` for business APIs and shared profile edits. Admin activation accepts `Active` or `Suspended`; public registration always returns `Pending`.

## 05. Categories

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/categories` | List owned categories, including inactive ones. | Query: `page=1&per_page=20` | `200` · List<Category> |
| POST | `/restaurant/categories` | Create a menu category. | Body: `{"cat_title":"Sandwiches","display_order":0,"is_active":true}` | `201` · Category |
| PATCH | `/restaurant/categories/{cat_id}` | Update title, display order, or activity. | Body: `{"cat_title":"Sandwiches","display_order":0,"is_active":true}` | `200` · Category |

## 06. Products

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/products` | List owned products; optionally filter by category. | Query: `page=1&per_page=20&cat_id=100` | `200` · List<Product> |
| GET | `/restaurant/products/{prod_id}` | Read product details for editing. | No body | `200` · Product |
| POST | `/restaurant/products` | Create a product in an owned category. | Body: `{"cat_id":"100","prod_name":"Burger","prod_description":"Grilled beef burger","prod_image_url":"https://example.com/burger.jpg","price":"100.00","is_active":true}` | `201` · Product |
| PATCH | `/restaurant/products/{prod_id}` | Update product details, price, category, or activity. | Body: `{"cat_id":"100","prod_name":"Burger","prod_description":"Grilled beef burger","prod_image_url":"https://example.com/burger.jpg","price":"100.00","is_active":true}` | `200` · Product |

## 07. Addons and Product Links

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/addons` | List owned addons. | Query: `page=1&per_page=20` | `200` · List<Addon> |
| POST | `/restaurant/addons` | Create an addon and its price. | Body: `{"addon_name":"Cheese","addon_price":"10.00","is_active":true}` | `201` · Addon |
| PATCH | `/restaurant/addons/{addon_id}` | Update addon name, price, or activity. | Body: `{"addon_name":"Cheese","addon_price":"10.00","is_active":true}` | `200` · Addon |
| GET | `/restaurant/products/{prod_id}/addons` | List the product's addon links, including inactive links. | No body | `200` · List<ProductAddon> |
| PUT | `/restaurant/products/{prod_id}/addons/{addon_id}` | Create a link or enable/disable an existing link. | Body: `{"is_active":true}` | `200` · ProductAddon |

Product-addon PUT returns `200` for both a new link and an update.

## 08. Offers

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/offers` | List owned offers, including inactive and expired ones. | Query: `page=1&per_page=20` | `200` · List<Offer> |
| POST | `/restaurant/offers` | Create an offer. | Body: `{"offer_title":"Lunch Offer","offer_description":"Lunch meal","initial_price":"150.00","real_price":"130.00","offer_image_url":null,"is_active":true,"starts_at":"2026-11-12T00:00:00Z","expires_at":"2026-12-01T00:00:00Z"}` | `201` · Offer |
| PATCH | `/restaurant/offers/{offer_id}` | Update offer details, prices, dates, or activity. | Body: `{"offer_title":"Lunch Offer","offer_description":"Lunch meal","initial_price":"150.00","real_price":"130.00","offer_image_url":null,"is_active":true,"starts_at":"2026-11-12T00:00:00Z","expires_at":"2026-12-01T00:00:00Z"}` | `200` · Offer |

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

For PATCH, `addons` is the full replacement selection when supplied; `[]` clears it. An omitted selection stays unchanged; when quantity changes, send the intended total addon quantities too. DELETE cart returns `EmptyCart`; deleting its last item may return a cart with no items. `is_available` in cart responses is calculated, not a new database field.

## 12. Checkout and Customer Orders

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| POST | `/customer/orders` | Checkout the cart using the address, reviewed prices, optional notes, and checkout key. | Body: `{"address_id":"50","quote_token":"<opaque-signed-quote>","notes":"Call on arrival","checkout_key":"7c453937-243e-4e4c-bc6c-5d4a8a18e303"}` | `201` · Order |
| GET | `/customer/orders` | List own orders; filter by active/history or status. | Query: `page=1&per_page=20&scope=history&status=Delivered` | `200` · List<OrderSummary> |
| GET | `/customer/orders/{order_id}` | Read an owned order with saved items, addons, address, total, and current status. | No body | `200` · Order |
| POST | `/customer/orders/{order_id}/cancel` | Cancel an owned Pending order. | No body | `200` · OrderState |

`quote_token` is a proposed signed quote format: it binds the customer, cart choices, current prices, address, fee, and expiry without adding a database column. The server compares it with current data at checkout. A successful retry with the same checkout key returns `200` and the existing `Order`, even if the cart is now empty. A different request using that key returns `409`. List query parameters are optional; `scope` is `active` or `history`.

## 13. Restaurant Order Handling

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/restaurant/orders` | List restaurant orders; filter by status or date. | Query: `page=1&per_page=20&status=Accepted&date_from=2026-11-01&date_to=2026-11-30` | `200` · List<OrderSummary> |
| GET | `/restaurant/orders/{order_id}` | Read order details for preparation. | No body | `200` · Order |
| POST | `/restaurant/orders/{order_id}/accept` | Change Pending to Accepted and automatically assign the delivery company in one transaction. | No body | `200` · OrderState |
| POST | `/restaurant/orders/{order_id}/reject` | Change Pending to Rejected. | No body | `200` · OrderState |

## 14. Order Assignment and Delivery

| Method | Route | Purpose | Request | Response data |
|---|---|---|---|---|
| GET | `/admin/orders` | Monitor orders across restaurants and delivery companies. | Query: `page=1&per_page=20&status=Accepted&date_from=2026-11-01&date_to=2026-11-30` | `200` · List<OrderSummary> |
| GET | `/admin/orders/{order_id}` | Read an order for support and monitoring. | No body | `200` · Order |
| POST | `/admin/orders/{order_id}/fail` | Mark an eligible order as Failed. | No body | `200` · OrderState |
| GET | `/delivery-company/orders` | List orders assigned to the company. | Query: `page=1&per_page=20&status=Accepted&date_from=2026-11-01&date_to=2026-11-30` | `200` · List<OrderSummary> |
| GET | `/delivery-company/orders/{order_id}` | Read assigned order details, pickup location, and delivery address. | No body | `200` · DeliveryOrder |
| PUT | `/delivery-company/orders/{order_id}/driver` | Assign or change an owned active driver before pickup. | Body: `{"driver_id":"30"}` | `200` · OrderState |
| POST | `/delivery-company/orders/{order_id}/pickup` | Mark an assigned Accepted order as Picked_Up. | No body | `200` · OrderState |
| POST | `/delivery-company/orders/{order_id}/deliver` | Mark a Picked_Up order as Delivered. | No body | `200` · OrderState |

Order action response values:

| Action | status | company_id | driver_id |
|---|---|---|---|
| Customer cancel | Cancelled | null | null |
| Restaurant reject | Rejected | null | null |
| Restaurant accept | Accepted | Automatically selected company ID | null |
| Company driver assignment | Accepted | Assigned company ID | Selected driver ID |
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
  "email_verified_at": "2026-11-12T10:00:00Z",
  "profile": {
    "user_id": "1",
    "profile_role": "Customer",
    "cus_avatar_url": null,
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z"
  },
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z"
  },
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
    "email_verified_at": "2026-11-12T10:00:00Z",
    "profile": {
      "user_id": "1",
      "profile_role": "Customer",
      "cus_avatar_url": null,
      "created_at": "2026-11-12T10:00:00Z",
      "updated_at": "2026-11-12T10:00:00Z"
    },
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z"
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
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z",
  "activation_status": "Active"
}
```

### CompanyProfile

```json
{
  "company_id": "20",
  "company_name": "Local Delivery",
  "company_phone": "+201000000020",
  "company_email": "office@example.com",
  "company_address": "5 Main Street, Ismailia",
  "is_active": true,
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
}
```

### Category

```json
{
  "cat_id": "100",
  "rest_id": "10",
  "cat_title": "Sandwiches",
  "display_order": 0,
  "is_active": true,
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z"
  },
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "starts_at": "2026-11-12T00:00:00Z",
  "expires_at": "2026-12-01T00:00:00Z",
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "starts_at": "2026-11-12T00:00:00Z",
  "expires_at": "2026-12-01T00:00:00Z"
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
  "updated_at": "2026-11-12T10:00:00Z"
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
  "quote_token": "<opaque-signed-quote>",
  "expires_at": "2026-11-12T10:05:00Z",
  "address_id": "50",
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
    "updated_at": "2026-11-12T10:00:00Z"
  },
  "delivery_fee": "20.00",
  "total_price": "240.00"
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
  "total_price": "240.00",
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "delivery_fee": "20.00",
  "total_price": "240.00",
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
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
  "delivery_fee": "20.00",
  "total_price": "240.00",
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
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z",
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
  "updated_at": "2026-11-12T10:00:00Z"
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
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z",
    "activation_status": "Pending",
    "user_id": "10",
    "profile_role": "Restaurant"
  },
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
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
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z",
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
