# AKEELA — Role Flows

## 1. Customer

**Register → Verify email → Login → Order → Follow delivery**

1. Register with full name, email, password, and phone.
2. Verify the email using the emailed OTP, then log in with email and password.
3. Save a delivery address and browse restaurants, products, and offers.
4. Add products or offers to the cart; choose allowed product addons.
5. Review quantities, current prices, delivery address, and delivery fee.
6. Confirm checkout. The server uses current prices plus EGP 30.00 delivery fee; the cart becomes a `Pending` order and is cleared. No earlier price is reserved.
7. Follow the order status until delivery, then view it in order history.

- The cart holds items from one restaurant at a time.
- The customer can cancel only while the order is `Pending`.
- Restaurant rejection or a failed delivery also appears in history.

## 2. Restaurant Owner

**Register → Verify email → Login → Wait for activation → Manage restaurant**

1. Register with owner account data and restaurant details.
2. Verify the owner's email using OTP, then log in.
3. Open the dashboard with restaurant activation status `Pending`.
4. Wait for Admin to activate the restaurant. Restaurant details, hours, and address can be updated to fix mistakes before/during review; catalog management and order handling await activation.
5. After activation becomes `Active`, manage restaurant details, hours, categories, products, addons, and offers.
6. Receive `Pending` orders and accept or reject them.
7. Accepting an order changes it to `Accepted` and automatically assigns the configured delivery company.

- If the delivery company is unavailable, acceptance fails and the order stays `Pending`.
- Admin can change activation to `Suspended` at any time. The owner can still log in and view the account status, but restaurant management is blocked and the public menu is hidden.
- Admin can reactivate the restaurant. Existing orders remain saved; assigned delivery companies can finish delivery.
- A disabled login account cannot log in, regardless of restaurant activation status.

## 3. Delivery Company

**Admin creates account → Verify email → Login → Assign driver → Complete delivery**

1. Admin creates the company account and profile.
2. The company verifies its email using OTP, then logs in.
3. Manage company details and add active drivers.
4. Receive orders automatically after restaurants accept them.
5. Assign an active company driver to an `Accepted` order.
6. After pickup, mark the order as `Picked_Up`.
7. After delivery, mark it as `Delivered`.

- The company sees only orders assigned to it.
- Drivers have no login accounts in this version; the company updates delivery status.
- The driver can be changed before pickup.

## 4. Admin

**Setup account → Verify email → Login → Review restaurants → Monitor platform**

1. Create the only Admin through the CLI setup command.
2. Log in with the CLI-created Admin. If provisioned with ADMIN_VERIFIED=false, verify email using OTP first.
3. Review self-registered restaurants with activation status `Pending`.
4. Activate restaurants, suspend them, or reactivate them later.
5. Create delivery company accounts. Additional Admin accounts are not allowed.
6. Enable or disable account login when needed.
7. Monitor orders and mark eligible `Accepted` or `Picked_Up` orders as `Failed` when needed.

- Admin does not create restaurant accounts or assign orders to delivery companies.
- The only Admin cannot be disabled.

## 5. Password Recovery — All Roles

**Forgot password → Email OTP → New password → Login again**

1. Enter the account email on Forgot Password.
2. Receive a password-reset OTP by email.
3. Submit email, OTP, and the new password.
4. After a successful reset, all existing login sessions end. Log in again.

## 6. Order Status Flow

| Step | Who performs it? | Result |
|---|---|---|
| Customer checks out | Customer | `Pending` |
| Restaurant accepts | Restaurant; company assignment is automatic | `Accepted` |
| Company confirms pickup | Assigned Delivery Company | `Picked_Up` |
| Company confirms delivery | Assigned Delivery Company | `Delivered` |
| Restaurant rejects a Pending order | Restaurant | `Rejected` |
| Customer cancels a Pending order | Customer | `Cancelled` |
| Admin marks an Accepted or Picked_Up order as failed | Admin | `Failed` |

`Delivered`, `Rejected`, `Cancelled`, and `Failed` are final states and appear in customer order history.
