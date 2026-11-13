# Module Ownership

Features 01-14 are implemented, including restaurant, customer, Admin and delivery-company order operations. Twenty table mappings and the Orders_History view exist. Orders owns every order read and transition; Delivery and Restaurants expose transaction-aware validation only.

| Module        | Responsibilities                                                                                    | Owned logical tables / view                                 | Feature sections                                       |
| ------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| `users`       | Shared account records, activity, role, Admin profile                                               | Users, Admin_Profiles                                       | 01–02 account data                                     |
| `auth`        | Registration orchestration, email OTP, login, JWT sessions, password recovery, account provisioning | Auth_Challenges, Auth_Sessions                              | 01; account creation in 02                             |
| `customers`   | Customer profile and saved addresses                                                                | Customer_Profiles, Customer_Addresses                       | 03; profile portions of 01                             |
| `restaurants` | Restaurant profile, approval/suspension, dashboard, public restaurant details                       | Restaurant_Profiles                                         | Restaurant review in 02, 04, restaurant portions of 09 |
| `catalog`     | Categories, products, addons, links, offers, public menus                                           | Categories, Products, Addons, Product_Addons, Offers        | 05–09                                                  |
| `delivery`    | Company profiles, drivers, active-company selection lookup                                          | Delivery_Company_Profiles, Delivery_Drivers                 | 10; lookup portions of 14                              |
| `cart`        | Customer cart, item/addon choices, current quote                                                    | Carts, Cart_Items, Cart_Item_Addons                         | 11                                                     |
| `orders`      | Checkout, snapshots, order queries/history, transitions, delivery assignment                        | Orders, Order_Items, Order_Item_Addons, Orders_History view | 12–14                                                  |

## Route ownership

- Roles are access policies, not a reason to duplicate domain modules.
- `/admin/users` provisioning belongs to Auth; account queries/activity belong to Users.
- `/admin/restaurants` and activation belong to Restaurants.
- `/restaurant/orders`, `/customer/orders`, `/admin/orders`, and `/delivery-company/orders` all belong to Orders; each may have its own role-specific controller in that module.
- `/me` is a cross-profile account use case coordinated through Auth and exported account/profile services. `/me/password` belongs to Auth.
- Public restaurant details belong to Restaurants; public menu routes belong to Catalog.
- Controllers with the same URL prefix may live in different modules. Every method/path pair must still be unique.

## Planned dependency direction

| Caller      | Permitted collaborators when needed                    |
| ----------- | ------------------------------------------------------ |
| Users       | No business module dependency                          |
| Customers   | Users                                                  |
| Restaurants | Users                                                  |
| Delivery    | Users                                                  |
| Catalog     | Restaurants                                            |
| Auth        | Users, Customers, Restaurants, Delivery                |
| Cart        | Customers, Restaurants, Catalog                        |
| Orders      | Users, Customers, Restaurants, Catalog, Cart, Delivery |

These are permitted directions, not imports to add in advance. Technical config/database dependencies are shared. Auth registers AccessGuard once as APP_GUARD. Routes are protected by default; public auth endpoints opt out with the common PublicRoute decorator, and logout explicitly remains protected. CurrentActor is a common HTTP decorator exposing only user/session IDs, never credentials. Other modules do not import Auth to authenticate requests, avoiding reverse dependencies. Business role, ownership, and activation checks remain in owning services.

No other module may write Orders tables, and Orders may not bypass another module's service to write its tables. Foreign keys and cross-module transactions do not change ownership.
