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
    ...timestamps,
  }),
  Product: object({ ...product, rest_id: id, is_active: bool, ...timestamps }),
  Addon: object({
    addon_id: id,
    rest_id: id,
    addon_name: text('Addon name.'),
    addon_price: money,
    is_active: bool,
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
  OrderItemAddon: object({ order_item_addon_id: id, ...addonSnapshot }),
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
