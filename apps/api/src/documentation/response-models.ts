import {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
export const object = (
  properties: Record<string, SchemaObject | ReferenceObject>,
  description?: string,
): SchemaObject => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  description,
});
const text = (description: string, nullable = false): SchemaObject => ({
  type: 'string',
  description,
  ...(nullable ? { nullable } : {}),
});
export const id: SchemaObject = {
  type: 'string',
  pattern: '^[1-9]\\d{0,18}$',
  example: '1',
  description:
    'Positive BIGINT identifier as a string. Maximum 9223372036854775807. Never convert to a JavaScript number.',
};
const nullableId = { ...id, nullable: true };
const money: SchemaObject = {
  type: 'string',
  pattern: '^\\d+\\.\\d{2}$',
  example: '100.00',
  description:
    'EGP decimal amount with two fraction digits. Use decimal arithmetic, not floating point.',
};
const time: SchemaObject = {
  type: 'string',
  format: 'date-time',
  example: '2026-11-19T12:00:00+02:00',
  description:
    'ISO 8601 instant with Africa/Cairo offset (+02:00 or +03:00 depending on daylight saving).',
};
const timestamps = { created_at: time, updated_at: time };
const bool: SchemaObject = { type: 'boolean' };
const integer: SchemaObject = { type: 'integer', minimum: 0 };
const url: SchemaObject = {
  type: 'string',
  format: 'uri',
  nullable: true,
  description: 'Public image URL, or null if not set.',
};
const coordinate = (axis: string): SchemaObject =>
  text(`${axis} decimal string, up to 7 decimal places.`);
const coordinates = {
  longitude: coordinate('Longitude (-180 to 180)'),
  latitude: coordinate('Latitude (-90 to 90)'),
};
const roles = ['Customer', 'Restaurant', 'Delivery_Company', 'Admin'];
export const orderStatus: SchemaObject = {
  type: 'string',
  enum: [
    'Pending',
    'Accepted',
    'Picked_Up',
    'Delivered',
    'Rejected',
    'Cancelled',
    'Failed',
  ],
};
const activation: SchemaObject = {
  type: 'string',
  enum: ['Pending', 'Active', 'Suspended'],
};
const array = (name: string): SchemaObject => ({
  type: 'array',
  items: ref(name),
});
const restaurant = {
  rest_id: id,
  rest_title: text('Restaurant display name.'),
  rest_description: text('Restaurant description.', true),
  rest_image_url_mobile: url,
  rest_address: text('Restaurant pickup address.'),
  ...coordinates,
  opens_at: text('Daily opening time, HH:mm:ss, Africa/Cairo.'),
  closes_at: text(
    'Daily closing time, HH:mm:ss, Africa/Cairo. May be on the following day.',
  ),
};
const company = {
  company_id: id,
  company_name: text('Company name.'),
  company_phone: text('International contact phone.'),
  company_email: {
    ...text('Contact email (may differ from login email).', true),
    format: 'email',
  },
  company_address: text('Company address.'),
  is_active: bool,
  ...timestamps,
};
const product = {
  prod_id: id,
  cat_id: id,
  prod_name: text('Product name.'),
  prod_description: text('Product description.', true),
  prod_image_url: url,
  price: money,
};
const offer = {
  offer_id: id,
  rest_id: id,
  offer_title: text('Offer name.'),
  offer_description: text('Offer description.', true),
  initial_price: money,
  real_price: money,
  offer_image_url: url,
  starts_at: time,
  expires_at: time,
};
const profileBase = { user_id: id, ...timestamps };
const summary = {
  order_id: id,
  rest_id: id,
  status: orderStatus,
  company_id: nullableId,
  driver_id: nullableId,
  total_price: money,
  ...timestamps,
};
const state = {
  order_id: id,
  status: orderStatus,
  company_id: nullableId,
  driver_id: nullableId,
  updated_at: time,
};
const addonSnapshot = {
  addon_id: id,
  addon_name: text('Addon name.'),
  quantity: { ...integer, minimum: 1 },
  unit_price: money,
  subtotal: money,
};
const cart = {
  cart_id: nullableId,
  rest_id: nullableId,
  items: array('CartItem'),
  items_subtotal: money,
  addons_subtotal: money,
  subtotal: money,
  updated_at: { ...time, nullable: true },
};
const order = {
  ...summary,
  customer_id: id,
  customer_address: text('Delivery address snapshot at checkout.'),
  delivery_longitude: coordinate('Delivery longitude'),
  delivery_latitude: coordinate('Delivery latitude'),
  delivery_fee: money,
  notes: text('Customer notes.', true),
  items: array('OrderItem'),
};
const account = {
  user_id: id,
  full_name: text('Account holder name.'),
  email: { type: 'string', format: 'email' } as SchemaObject,
  phone: text('International login account phone.'),
  role: { type: 'string', enum: roles } as SchemaObject,
  is_active: bool,
  email_verified_at: { ...time, nullable: true },
  profile: {
    oneOf: [
      ref('CustomerAccountProfile'),
      ref('RestaurantAccountProfile'),
      ref('CompanyAccountProfile'),
      ref('AdminAccountProfile'),
      { type: 'object', nullable: true, enum: [null] },
    ],
  },
  ...timestamps,
};

// Public response contracts only. Never register persistence entities here.
export const responseModels: Record<string, SchemaObject> = {
  User: object(
    account,
    'Account and role-specific profile. Profile can be null if absent; no password hash or session secrets are exposed.',
  ),
  CustomerAccountProfile: object({
    ...profileBase,
    profile_role: { type: 'string', enum: ['Customer'] },
    cus_avatar_url: url,
  }),
  RestaurantAccountProfile: object({
    ...profileBase,
    ...restaurant,
    profile_role: { type: 'string', enum: ['Restaurant'] },
    is_active: bool,
    activation_status: activation,
  }),
  CompanyAccountProfile: object({
    ...profileBase,
    ...company,
    profile_role: { type: 'string', enum: ['Delivery_Company'] },
  }),
  AdminAccountProfile: object({
    ...profileBase,
    profile_role: { type: 'string', enum: ['Admin'] },
  }),
  UnverifiedUser: {
    ...object({
      ...account,
      role: { type: 'string', enum: ['Customer'] },
      profile: ref('CustomerAccountProfile'),
      email_verified_at: { ...time, nullable: true, example: null },
    }),
    description:
      'New customer, email_verified_at is null. No tokens; verify email and then log in.',
  },
  UnverifiedRestaurantUser: object(
    {
      ...account,
      role: { type: 'string', enum: ['Restaurant'] },
      profile: ref('RestaurantAccountProfile'),
      email_verified_at: { ...time, nullable: true, example: null },
    },
    'New restaurant owner. Profile activation_status is Pending. No tokens.',
  ),
  Tokens: object({
    token_type: { type: 'string', enum: ['Bearer'] },
    access_token: text(
      'JWT access token. Example values are placeholders, not usable tokens.',
    ),
    expires_in: {
      type: 'integer',
      example: 900,
      description: 'Access lifetime in seconds; configurable.',
    },
    refresh_token: text(
      'Opaque rotating refresh token. Store securely; never place it in URLs.',
    ),
    refresh_expires_in: {
      type: 'integer',
      example: 2592000,
      description:
        'Remaining absolute session lifetime in seconds; may be shorter after refresh.',
    },
  }),
  Login: object({ user: ref('User'), tokens: ref('Tokens') }),
  Address: object({
    address_id: id,
    user_id: id,
    address_title: text('Saved address label.'),
    address_line: text('Full address text.'),
    ...coordinates,
    is_default: bool,
    ...timestamps,
  }),
  RestaurantProfile: object({
    ...restaurant,
    is_active: bool,
    ...timestamps,
    activation_status: activation,
  }),
  CompanyProfile: object({ ...company, user_id: id }),
  Category: object({
    cat_id: id,
    rest_id: id,
    cat_title: text('Category name, unique within a restaurant.'),
    display_order: integer,
    is_active: bool,
    product_count: integer,
    ...timestamps,
  }),
  Product: object({
    ...product,
    cat_id: nullableId,
    rest_id: id,
    is_active: bool,
    ...timestamps,
  }),
  Addon: object({
    addon_id: id,
    rest_id: id,
    addon_name: text('Addon name.'),
    addon_price: money,
    is_active: bool,
    linked_product_ids: {
      type: 'array',
      items: id,
      description: 'Owned product IDs with an active link to this addon.',
    },
    ...timestamps,
  }),
  ProductAddon: object({
    rest_id: id,
    prod_id: id,
    addon_id: id,
    is_active: bool,
    addon: ref('Addon'),
    ...timestamps,
  }),
  Offer: object({ ...offer, is_active: bool, ...timestamps }),
  Driver: object({
    driver_id: id,
    company_id: id,
    driver_name: text('Driver name.'),
    driver_phone: text('International driver phone.'),
    driver_email: { ...text('Driver email.', true), format: 'email' },
    is_active: bool,
    ...timestamps,
  }),
  PublicRestaurant: object(
    { ...restaurant, is_open: bool },
    'Active, approved restaurant. is_open is computed from daily Cairo opening hours.',
  ),
  PublicCategory: object({
    cat_id: id,
    cat_title: text('Category name.'),
    display_order: integer,
  }),
  PublicProduct: object(product),
  PublicAddon: object({
    addon_id: id,
    addon_name: text('Addon name.'),
    addon_price: money,
  }),
  PublicProductDetails: object({ ...product, addons: array('PublicAddon') }),
  PublicOffer: object(offer),
  CartAddon: object(
    addonSnapshot,
    'Quantity is the total for this cart line, not per product.',
  ),
  CartItem: object(
    {
      cart_item_id: id,
      prod_id: nullableId,
      offer_id: nullableId,
      item_name: text('Current item name.'),
      quantity: { ...integer, minimum: 1 },
      unit_price: money,
      subtotal: money,
      addons: array('CartAddon'),
      line_total: money,
      is_available: bool,
    },
    'Exactly one of prod_id or offer_id is non-null. subtotal excludes addons; line_total includes them. Availability is calculated.',
  ),
  Cart: object(
    cart,
    'Current server prices. Missing cart has null IDs/updated_at, empty items and zero totals. A cleared existing cart may keep its IDs.',
  ),
  EmptyCart: object(
    cart,
    'No items. IDs/timestamp may be null when no cart exists; all totals are zero.',
  ),
  DeliveryAddress: object({
    address_line: text('One-time delivery address.'),
    ...coordinates,
  }),
  Quote: object(
    {
      address_id: nullableId,
      delivery_address: ref('DeliveryAddress'),
      cart: ref('Cart'),
      delivery_fee: money,
      total_price: money,
    },
    'Informational current totals, not a reservation. address_id is null for a one-time address.',
  ),
  OrderSummary: object(summary),
  OrderItemAddon: object({
    order_item_addon_id: id,
    ...addonSnapshot,
    addon_id: nullableId,
  }),
  OrderItem: object(
    {
      order_item_id: id,
      prod_id: nullableId,
      offer_id: nullableId,
      item_name: text('Item name snapshot.'),
      unit_price: money,
      quantity: { ...integer, minimum: 1 },
      subtotal: money,
      addons: array('OrderItemAddon'),
    },
    'Snapshot. subtotal is unit_price × quantity; addons are separate.',
  ),
  Order: object(
    order,
    'Prices, items and delivery address are saved snapshots. Status/assignment can change.',
  ),
  DeliveryOrder: object({
    ...order,
    pickup: object({
      rest_title: text('Restaurant name.'),
      rest_address: text('Current restaurant pickup address.'),
      ...coordinates,
    }),
  }),
  OrderState: object(state),
  OrderStatusCounts: object(
    {
      Pending: integer,
      Accepted: integer,
      Picked_Up: integer,
      Delivered: integer,
      Rejected: integer,
      Cancelled: integer,
      Failed: integer,
    },
    'Order counts grouped by status for the authenticated scope.',
  ),
  AdminAnalyticsKpis: object({
    delivered_gmv: money,
    delivery_fees_total: money,
    avg_order_value: money,
    total_orders: integer,
    delivered_orders: integer,
    completion_rate: { type: 'number', minimum: 0, maximum: 100 },
    rejection_rate: { type: 'number', minimum: 0, maximum: 100 },
    cancellation_rate: { type: 'number', minimum: 0, maximum: 100 },
    failure_rate: { type: 'number', minimum: 0, maximum: 100 },
    new_customers: integer,
    new_restaurants: integer,
  }),
  AdminAnalyticsPreviousKpis: object({
    delivered_gmv: money,
    delivery_fees_total: money,
    avg_order_value: money,
    total_orders: integer,
    delivered_orders: integer,
    new_customers: integer,
    new_restaurants: integer,
  }),
  AdminAnalyticsDailyPoint: object({
    date: text('Africa/Cairo calendar date (YYYY-MM-DD).'),
    orders: integer,
    delivered: integer,
    gmv: money,
  }),
  AdminAnalyticsHourPoint: object({
    hour: { type: 'integer', minimum: 0, maximum: 23 },
    orders: integer,
  }),
  AdminAnalyticsRestaurant: object({
    rest_id: id,
    rest_title: text('Restaurant display name.'),
    total_orders: integer,
    delivered_orders: integer,
    rejected_orders: integer,
    rejection_rate: { type: 'number', minimum: 0, maximum: 100 },
    gmv: money,
  }),
  AdminAnalyticsTopItem: object({
    rest_id: id,
    rest_title: text('Restaurant display name.'),
    item_name: text('Snapshot menu item name.'),
    units_sold: integer,
    revenue: money,
  }),
  AdminAnalyticsAlerts: object({
    stale_pending_orders: integer,
    stale_accepted_orders: integer,
    pending_restaurants: integer,
    unverified_companies: integer,
  }),
  AdminAnalyticsPlatformTotals: object({
    total_users: integer,
    customers: integer,
    restaurants_total: integer,
    restaurants_active: integer,
    restaurants_pending: integer,
    restaurants_suspended: integer,
    delivery_companies: integer,
    active_drivers: integer,
    inactive_drivers: integer,
  }),
  AdminAnalytics: object(
    {
      range: { type: 'string', enum: ['today', '7d', '30d', '90d', 'all'] },
      generated_at: time,
      kpis: ref('AdminAnalyticsKpis'),
      previous_kpis: {
        oneOf: [
          ref('AdminAnalyticsPreviousKpis'),
          { type: 'object', nullable: true, enum: [null] },
        ],
      },
      status_breakdown: ref('OrderStatusCounts'),
      daily_series: array('AdminAnalyticsDailyPoint'),
      peak_hours: array('AdminAnalyticsHourPoint'),
      top_restaurants: array('AdminAnalyticsRestaurant'),
      attention_restaurants: array('AdminAnalyticsRestaurant'),
      top_items: array('AdminAnalyticsTopItem'),
      alerts: ref('AdminAnalyticsAlerts'),
      platform_totals: ref('AdminAnalyticsPlatformTotals'),
    },
    'Executive platform analytics for the selected Africa/Cairo time window.',
  ),
  DeliveryAnalyticsKpis: object({
    delivery_fees_earned: money,
    avg_delivery_fee: money,
    cod_collected_value: money,
    assigned_orders: integer,
    delivered_orders: integer,
    failed_orders: integer,
    delivery_success_rate: { type: 'number', minimum: 0, maximum: 100 },
    failure_rate: { type: 'number', minimum: 0, maximum: 100 },
    avg_fulfillment_minutes: { type: 'number', minimum: 0, nullable: true },
  }),
  DeliveryAnalyticsPreviousKpis: object({
    delivery_fees_earned: money,
    cod_collected_value: money,
    assigned_orders: integer,
    delivered_orders: integer,
    failed_orders: integer,
    avg_fulfillment_minutes: { type: 'number', minimum: 0, nullable: true },
  }),
  DeliveryAnalyticsLiveQueue: object({
    unassigned_accepted: integer,
    in_transit: integer,
    stale_unassigned: integer,
    long_in_transit: integer,
    inactive_driver_orders: integer,
  }),
  DeliveryAnalyticsStatusBreakdown: object({
    Accepted: integer,
    Picked_Up: integer,
    Delivered: integer,
    Failed: integer,
  }),
  DeliveryAnalyticsDailyPoint: object({
    date: text('Africa/Cairo calendar date (YYYY-MM-DD).'),
    assigned: integer,
    delivered: integer,
    failed: integer,
    delivery_fees: money,
  }),
  DeliveryAnalyticsHourPoint: object({
    hour: { type: 'integer', minimum: 0, maximum: 23 },
    orders: integer,
  }),
  DeliveryAnalyticsFleet: object({
    total_drivers: integer,
    active_drivers: integer,
    inactive_drivers: integer,
    busy_drivers: integer,
    idle_active_drivers: integer,
  }),
  DeliveryAnalyticsDriver: object({
    driver_id: id,
    driver_name: text('Driver full name.'),
    driver_phone: text('International driver phone.'),
    is_active: bool,
    current_load: integer,
    delivered_orders: integer,
    failed_orders: integer,
    delivery_fees: money,
    avg_fulfillment_minutes: { type: 'number', minimum: 0, nullable: true },
    success_rate: { type: 'number', minimum: 0, maximum: 100 },
  }),
  DeliveryAnalyticsRestaurant: object({
    rest_id: id,
    rest_title: text('Restaurant display name.'),
    assigned_orders: integer,
    delivered_orders: integer,
    failed_orders: integer,
    delivery_fees: money,
  }),
  DeliveryAnalytics: object(
    {
      range: { type: 'string', enum: ['today', '7d', '30d', '90d', 'all'] },
      generated_at: time,
      kpis: ref('DeliveryAnalyticsKpis'),
      previous_kpis: {
        oneOf: [
          ref('DeliveryAnalyticsPreviousKpis'),
          { type: 'object', nullable: true, enum: [null] },
        ],
      },
      live_queue: ref('DeliveryAnalyticsLiveQueue'),
      status_breakdown: ref('DeliveryAnalyticsStatusBreakdown'),
      daily_series: array('DeliveryAnalyticsDailyPoint'),
      peak_hours: array('DeliveryAnalyticsHourPoint'),
      fleet: ref('DeliveryAnalyticsFleet'),
      driver_leaderboard: array('DeliveryAnalyticsDriver'),
      top_pickup_restaurants: array('DeliveryAnalyticsRestaurant'),
    },
    'Company-scoped dispatch, fleet, and delivery performance analytics for the selected Africa/Cairo time window.',
  ),
  RestaurantAnalyticsKpis: object({
    food_revenue: money,
    delivery_fees_total: money,
    gross_gmv: money,
    addons_revenue: money,
    avg_order_value: money,
    total_orders: integer,
    delivered_orders: integer,
    rejected_orders: integer,
    cancelled_orders: integer,
    acceptance_rate: { type: 'number', minimum: 0, maximum: 100 },
    completion_rate: { type: 'number', minimum: 0, maximum: 100 },
    rejection_rate: { type: 'number', minimum: 0, maximum: 100 },
    cancellation_rate: { type: 'number', minimum: 0, maximum: 100 },
    unique_customers: integer,
    repeat_customers: integer,
    repeat_customer_rate: { type: 'number', minimum: 0, maximum: 100 },
    avg_fulfillment_minutes: { type: 'number', minimum: 0, nullable: true },
  }),
  RestaurantAnalyticsPreviousKpis: object({
    food_revenue: money,
    addons_revenue: money,
    avg_order_value: money,
    total_orders: integer,
    delivered_orders: integer,
    avg_fulfillment_minutes: { type: 'number', minimum: 0, nullable: true },
  }),
  RestaurantAnalyticsLiveAlerts: object({
    pending_orders: integer,
    stale_pending_orders: integer,
    active_in_progress: integer,
    inactive_products: integer,
    expiring_offers: integer,
  }),
  RestaurantAnalyticsDailyPoint: object({
    date: text('Africa/Cairo calendar date (YYYY-MM-DD).'),
    orders: integer,
    delivered: integer,
    food_revenue: money,
    delivery_fees: money,
    gross_gmv: money,
  }),
  RestaurantAnalyticsHourPoint: object({
    hour: { type: 'integer', minimum: 0, maximum: 23 },
    orders: integer,
  }),
  RestaurantAnalyticsMenuTotals: object({
    active_categories: integer,
    active_products: integer,
    inactive_products: integer,
    active_addons: integer,
    active_offers: integer,
  }),
  RestaurantAnalyticsTopItem: object({
    item_name: text('Snapshot item or offer name.'),
    item_type: { type: 'string', enum: ['product', 'offer'] },
    units_sold: integer,
    revenue: money,
    share_pct: { type: 'number', minimum: 0, maximum: 100 },
  }),
  RestaurantAnalyticsSlowItem: object({
    prod_id: id,
    prod_name: text('Active product name.'),
    cat_title: text('Parent category title.'),
    price: money,
    units_sold: integer,
  }),
  RestaurantAnalyticsTopAddon: object({
    addon_name: text('Snapshot addon name.'),
    units_sold: integer,
    revenue: money,
  }),
  RestaurantAnalyticsCategory: object({
    cat_title: text('Category title or offers bucket.'),
    units_sold: integer,
    revenue: money,
    share_pct: { type: 'number', minimum: 0, maximum: 100 },
  }),
  RestaurantAnalytics: object(
    {
      range: {
        type: 'string',
        enum: ['today', '7d', '30d', '90d', 'all', 'custom'],
      },
      generated_at: time,
      kpis: ref('RestaurantAnalyticsKpis'),
      previous_kpis: {
        oneOf: [
          ref('RestaurantAnalyticsPreviousKpis'),
          { type: 'object', nullable: true, enum: [null] },
        ],
      },
      live_alerts: ref('RestaurantAnalyticsLiveAlerts'),
      status_breakdown: ref('OrderStatusCounts'),
      daily_series: array('RestaurantAnalyticsDailyPoint'),
      peak_hours: array('RestaurantAnalyticsHourPoint'),
      menu_totals: ref('RestaurantAnalyticsMenuTotals'),
      top_items: array('RestaurantAnalyticsTopItem'),
      slow_items: array('RestaurantAnalyticsSlowItem'),
      top_addons: array('RestaurantAnalyticsTopAddon'),
      category_breakdown: array('RestaurantAnalyticsCategory'),
    },
    'Restaurant-scoped sales, kitchen operations, loyalty, and menu intelligence analytics for the selected Africa/Cairo time window.',
  ),
  RestaurantReview: object({
    owner: {
      ...object({
        user_id: id,
        full_name: text('Owner name.'),
        email: { type: 'string', format: 'email' },
        phone: text('International phone.'),
        email_verified_at: { ...time, nullable: true },
        is_active: bool,
      }),
      nullable: true,
    },
    profile: ref('RestaurantAccountProfile'),
  }),
  RestaurantDashboard: object({
    rest_id: id,
    activation_status: activation,
    can_manage: bool,
    message: text('Human-readable activation guidance.'),
  }),
  ImageUpload: object({
    image_url: {
      type: 'string',
      format: 'uri',
      description:
        'Persistent public /images/<uuid>.webp URL. The owning profile/product/offer URL is updated automatically.',
    },
  }),
  Health: object({
    status: { type: 'string', enum: ['ok'] },
    checked_at: time,
  }),
  DeviceToken: object({
    token_id: id,
    platform: { type: 'string', enum: ['android', 'ios', 'web'] },
    device_label: { ...text('Optional device name.'), nullable: true },
    token_preview: text('Masked preview of the registered FCM token.'),
    last_seen_at: time,
    created_at: time,
    updated_at: time,
  }),
  NotificationDispatch: object({
    fcm_configured: bool,
    targeted_users: integer,
    targeted_tokens: integer,
    sent: integer,
    failed: integer,
    pruned_tokens: integer,
  }),
  SearchRestaurant: object({
    ...restaurant,
    is_open: bool,
    matched_in: {
      type: 'array',
      items: {
        type: 'string',
        enum: ['name', 'description', 'category', 'product', 'offer'],
      },
      description: 'Signals that matched the search query for this restaurant.',
    },
    matching_items_count: integer,
  }),
  SearchProduct: object({
    ...product,
    cat_title: text('Owning category title.'),
    rest_id: id,
    rest_title: text('Owning restaurant display name.'),
    rest_image_url_mobile: url,
    is_open: bool,
  }),
  SearchOffer: object({
    ...offer,
    rest_title: text('Owning restaurant display name.'),
    rest_image_url_mobile: url,
    is_open: bool,
  }),
  PublicOfferFeedItem: object(
    {
      ...offer,
      rest_title: text('Owning restaurant display name.'),
      rest_image_url_mobile: url,
      is_open: bool,
      discount_percentage: {
        ...integer,
        maximum: 100,
        description:
          'Rounded integer discount percentage calculated from initial_price and real_price.',
      },
      orders_count: {
        ...integer,
        description:
          'Total units ordered for this offer in the last 30 days (excluding Cancelled, Rejected, and Failed orders).',
      },
    },
    'Active sale-window offer enriched with restaurant metadata, discount percentage, and recent demand count for the Home Page offers feed.',
  ),
  SearchCategory: object({
    cat_id: id,
    cat_title: text('Category title.'),
    display_order: integer,
    rest_id: id,
    rest_title: text('Owning restaurant display name.'),
    rest_image_url_mobile: url,
    is_open: bool,
  }),
  GlobalSearchCounts: object({
    restaurants: integer,
    products: integer,
    offers: integer,
    categories: integer,
  }),
  GlobalSearch: object(
    {
      query: text('Original trimmed search query.'),
      normalized_query: text(
        'Normalized Arabic/Latin query string used for matching.',
      ),
      type: {
        type: 'string',
        enum: ['all', 'restaurants', 'products', 'offers', 'categories'],
      },
      counts: ref('GlobalSearchCounts'),
      restaurants: array('SearchRestaurant'),
      products: array('SearchProduct'),
      offers: array('SearchOffer'),
      categories: array('SearchCategory'),
    },
    'Grouped public search results across active restaurants, products, active sale-window offers, and categories.',
  ),
  PaginationMeta: object({
    page: { ...integer, minimum: 1 },
    per_page: { ...integer, minimum: 1, maximum: 100 },
    total: integer,
    last_page: { ...integer, minimum: 1 },
  }),
  ApiError: object({
    success: { type: 'boolean', enum: [false] },
    message: text(
      'Safe user-facing explanation. Do not branch on this text; use error.code.',
    ),
    error: {
      type: 'object',
      required: ['code'],
      properties: {
        code: text('Machine-readable error code.'),
        fields: {
          type: 'object',
          additionalProperties: { type: 'array', items: { type: 'string' } },
          description:
            'Optional validation messages by field path, e.g. profile.longitude or addons.0.quantity.',
        },
      },
    },
  }),
};
