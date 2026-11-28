import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
  OpenAPIObject,
  OperationObject,
  ResponseObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { operations, OperationDoc } from './operations';
import { responseExamples } from './examples';
import { createRoleDocument, swaggerRoles } from './role-documents';
import { id, object, ref, responseModels } from './response-models';
import {
  PaginationQuery,
  ListUsersQuery,
  ListRestaurantsQuery,
} from '../modules/users/admin.dto';
import { ListAddressesQuery } from '../modules/customers/customers.dto';
import {
  ListCategoriesQuery,
  ListProductsQuery,
  ListRestaurantProductsQuery,
  ListAddonsQuery,
  ListOffersQuery,
} from '../modules/catalog/catalog.dto';
import { GlobalSearchQuery } from '../modules/catalog/search.dto';
import { ListPublicOffersFeedQuery } from '../modules/catalog/offers-feed.dto';
import { ListDriversQuery } from '../modules/delivery/delivery.dto';
import {
  AdminAnalyticsQuery,
  AdminRestaurantAnalyticsQuery,
  DeliveryAnalyticsQuery,
  ListOrdersQuery,
  OperationalOrdersQuery,
  RestaurantAnalyticsQuery,
} from '../modules/orders/orders.dto';

const guide = `REST API for AKEELA mobile and browser clients.

### Start here
1. Browse the public menu without a token. Register a Customer or Restaurant, verify the email OTP, then log in.
2. Copy access_token into **Authorize** (paste the token alone). Protected calls send Authorization: Bearer <access_token>.
3. Refresh through POST /auth/refresh using the JSON refresh_token. Save BOTH returned tokens; refresh tokens rotate once. A failed/expired session requires login again. No cookie or cross-subdomain SSO contract.

### Data and errors
- Base path: /api/v1. All IDs, money and coordinates are **strings**; quantities/counts are integers. Currency: EGP.
- Times are ISO 8601 with Egypt's Africa/Cairo offset, including daylight saving. Offer inputs require Z or an explicit offset; daily hours use HH:mm:ss.
- Success: {success:true,message,data}; paginated lists also include meta. Message-only success has data:null. Failures: {success:false,message,error:{code,fields?}}; no data property.
- Branch on HTTP status and error.code, never message text. 422 fields use dotted paths, including array indexes. Unknown body fields and arrays instead of nested objects are rejected.
- PATCH: omit fields to keep them; use null only where the schema allows it. Examples show possible values, not defaults or live records.
- Authentication, ownership, role and restaurant activation are always checked by the server. Admin/Delivery credentials are not created by public customer registration.

### Mobile integration
- Default access lifetime: 900 seconds; refresh session: 30 days (configurable). Use a single refresh operation for concurrent 401s; do not replay a used refresh token.
- Email OTP: 6 digits as text, 10 minutes, 5 attempts, resend cooldown 60 seconds (configurable). Never log passwords, codes or tokens. Resend/forgot responses do not reveal account eligibility.
- Checkout reprices on the server and immediately creates the order. There is no idempotency key or quote token. On a lost response, inspect orders/cart before deciding to retry.
- Upload one file using multipart/form-data; let the HTTP client generate its boundary. Returned image_url is public and stored on the related record automatically.
- Realtime uses **Socket.IO v4**, not raw WebSocket: namespace /orders, path /socket.io, websocket transport, handshake auth:{token:access_token}. order.created/order.updated payload: order_id, status, company_id, driver_id, updated_at. Re-fetch REST on each event/reconnect; events are best effort with no replay. No order changes are sent through sockets. JWT expiry disconnects; refresh through REST and reconnect.

### Using this page
The server selector defaults to this API origin. Try it out sends REAL requests to the selected server, including email, uploads and order changes. Example IDs must be replaced with records you own. Authorize is kept in memory only and is not saved across page reloads. No external schema validator is used.
`;

const rules: Record<string, string> = {
  '01': 'Public registration is only for Customer and Restaurant. Email verification does not log in; call login next. Restaurant owners start Pending and need Admin activation before management. Login requires an active, email-verified account. Registration can succeed even if email delivery fails; read the message and use resend after cooldown. Password change/reset revokes all sessions; log in again. PATCH /me avatar is Customer-only; email/role/activity cannot be changed here. Pending/Suspended restaurant owners may read their own account/profile/dashboard and use auth/security, but cannot edit account/profile or manage catalog/orders/images.',
  '02': 'Admin only. The single Admin is provisioned by CLI; POST /admin/users with role Admin returns 409. Delivery_Company creation requires one profile object. Disabling the Admin or a Delivery_Company account is blocked in this single-company version. Restaurant activation accepts Active or Suspended; Pending is assigned at registration.',
  '03': 'Customer only; address ownership is enforced. Maximum 2 saved addresses; a third returns 409 CONFLICT. Only one address is default. One-time checkout addresses do not count as saved addresses.',
  '04': 'Restaurant only. Reading profile/dashboard is allowed while Pending/Suspended; edits require activation Active. is_active=false pauses new orders and public sale, while existing orders can still be processed. Closing earlier than opening supports overnight hours. Hours use Africa/Cairo.',
  '05': 'Restaurant only; active, verified owner with activation Active. Category names are unique within the restaurant, not globally. New categories automatically receive the next sequential display_order (1..N). PATCH display_order swaps positions atomically with the existing category at that position. Categories include product_count; DELETE is allowed only when product_count is 0 (compacting remaining orders to 1..N). Own lists include inactive records.',
  '06': 'Restaurant only; activation Active. Category must belong to the owner, or may be null for unlinked inactive products. Unlinked products are always inactive (is_active=false) and cannot be activated until linked to a category; linking an unlinked product auto-activates it unless is_active=false is passed. Filter with cat_id or unlinked=true|false. DELETE permanently deletes only unlinked products (cat_id=null), preserves order item snapshots, and auto-deactivates addons left with zero product links. Price and name edits do not rewrite order snapshots.',
  '07': 'Restaurant only; activation Active. New addons start unlinked and inactive (is_active=false) and cannot be activated until linked to at least one product. Linking an unlinked addon to its first product via PUT auto-activates it; unlinking from its last product auto-deactivates it. Filter with unlinked=true|false; responses include linked_product_ids. DELETE permanently deletes only unlinked addons (zero active product links) while preserving order item addon snapshots. Customers select only linked, active addons in the cart. Offers cannot have addons. PUT link returns 200 for both creation and update. Link list is a plain array without pagination meta.',
  '08': 'Restaurant only; activation Active. initial_price and real_price are decimal EGP strings; real_price must not exceed initial_price. starts_at must be before expires_at, both with explicit Z or UTC offset. Owner list includes inactive/expired offers; public sale requires an eligible restaurant and current active offer.',
  '09': 'Public, no JWT required. Shows approved, active restaurants with active verified owners and eligible catalog entries only. Products require an active category. Offers must be active and within their sale dates. A closed restaurant can appear with is_open=false, but checkout requires it to be open. Product details include only allowed active addons.',
  '10': 'Delivery_Company only. Drivers are dispatcher-managed records, not login accounts. Ownership is checked. Company service/account cannot be disabled in this single-company version (409 CONFLICT); individual driver activity is editable.',
  '11': 'Customer only; owned cart. One restaurant per cart: another restaurant returns 409 CART_RESTAURANT_CONFLICT unless the current cart has zero items; clear a non-empty cart explicitly first. Item is product OR offer, never both/neither. Offers take no addons. Addon quantity is the total for the whole line. Matching product/addon ratios merge quantities; different ratios remain separate rows. On PATCH, supplied addons replace the selection; [] clears it. Omitted addons stay unchanged; send the intended addon totals when changing quantity. Quantity 0 or removing the last item clears the line and deletes the empty parent cart automatically. No business cart caps; storage/money overflow still returns an error. Prices and is_available are calculated from the current catalog. Quote validates current sale/address data but does not reserve prices or create an order.',
  '12': 'Customer only; owned orders. Checkout accepts exactly one owned address_id OR one-time delivery_address; notes optional. It validates availability and uses current server prices and delivery fee (initially 30.00 EGP), creates a Pending order and clears the cart in one transaction. No quote_token, expected_total_price, checkout_key or request hash is accepted. Order items, addon prices and destination are snapshots. Cancel is only allowed while Pending. No automatic retry guarantee for checkout.',
  '13': 'Restaurant only; activation Active. Pausing new sales via is_active=false does not block existing orders. Accept/reject require Pending. Accept atomically assigns the configured delivery company; missing/unavailable company returns 409 DELIVERY_COMPANY_UNAVAILABLE and leaves Pending. Retrying accept on an already Accepted order returns its current state. Other invalid transitions return 409. Date bounds are inclusive whole days in Africa/Cairo; date_from must not follow date_to.',
  '14': 'Admin routes require Admin; Delivery_Company routes require the assigned company. Company assignment is automatic when the restaurant accepts, never manual by Admin. Assign or reassign an owned active driver while Accepted or Picked_Up; driver assignment (PUT /delivery-company/orders/{order_id}/driver) immediately transitions the order to Picked_Up. Explicit pickup (POST /delivery-company/orders/{order_id}/pickup) is idempotent across Accepted and Picked_Up; delivery changes Picked_Up to Delivered, and Picked_Up orders auto-deliver after 90 minutes. Invalid transitions return 409; driver absence can return DRIVER_REQUIRED. Admin fail is allowed only from Accepted/Picked_Up. Pickup location is current restaurant data; customer destination/prices remain snapshots. Date filters are inclusive whole Cairo days, date_from <= date_to.',
  '15': 'Customer avatar requires Customer; restaurant/profile/product/offer images require the owner Restaurant with activation Active. Exactly one binary field named file; no extra fields/files. JPEG, PNG or WebP only, non-animated, at most 5 MiB (5242880 bytes) and 16777216 input pixels. Content is checked, metadata removed and image converted to WebP with target-aware bounds without enlargement. The related URL is saved automatically. Ten upload attempts per account per minute; 429 may occur. Unreferenced files older than 24 hours are cleaned up automatically.',
  '16': 'Public operational checks, no JWT required. live checks process liveness; ready verifies the database with SELECT 1. Database failure returns 503 NOT_READY without connection details.',
  '18': 'Authenticated users register and manage FCM device tokens bound to their active session (up to 15 devices per account; re-registering an existing token reassigns it to the current user/session). Order lifecycle events automatically trigger best-effort FCM HTTP v1 pushes to relevant active recipients and prune permanently unregistered tokens. Admin can dispatch custom or test notifications to a single user_id or role.',
};

function isPublic(doc: OperationDoc): boolean {
  return (
    (doc.path.startsWith('/api/v1/auth/') && !doc.path.endsWith('/logout')) ||
    doc.path.startsWith('/api/v1/restaurants') ||
    doc.path === '/api/v1/offers' ||
    doc.path === '/api/v1/search' ||
    doc.path.startsWith('/api/v1/health/')
  );
}

function success(doc: OperationDoc, paginated: boolean): SchemaObject {
  const list = doc.model.match(/^List<(.+)>$/);
  const model = doc.model.includes(' or ') ? 'Cart' : doc.model;
  return object({
    success: { type: 'boolean', enum: [true] },
    message: {
      type: 'string',
      description: 'Human-readable result; not a stable machine code.',
    },
    data: list
      ? { type: 'array', items: ref(list[1]!) }
      : model === 'Message'
        ? {
            type: 'object',
            nullable: true,
            enum: [null],
            description: 'Always null for message-only responses.',
          }
        : ref(model),
    ...(paginated ? { meta: ref('PaginationMeta') } : {}),
  });
}

function example(
  doc: OperationDoc,
  paginated: boolean,
): Record<string, unknown> {
  const list = doc.model.match(/^List<(.+)>$/);
  const model = doc.model.includes(' or ') ? 'Cart' : doc.model;
  const value =
    model === 'RestaurantAccountProfile'
      ? (responseExamples.UnverifiedRestaurantUser as {
          profile: Record<string, unknown>;
        })
      : null;
  const data = value
    ? { ...value.profile, activation_status: 'Active' }
    : responseExamples[list?.[1] ?? model];
  const envelope = {
    success: true,
    message: 'Request completed.',
    data: model === 'Message' ? null : list ? [data] : data,
    ...(paginated
      ? { meta: { page: 1, per_page: 20, total: 1, last_page: 1 } }
      : {}),
  };
  if (model === 'OrderState') {
    const action = doc.path.split('/').at(-1);
    const status =
      action === 'cancel'
        ? 'Cancelled'
        : action === 'reject'
          ? 'Rejected'
          : action === 'pickup' || action === 'driver'
            ? 'Picked_Up'
            : action === 'deliver'
              ? 'Delivered'
              : action === 'fail'
                ? 'Failed'
                : 'Accepted';
    envelope.data = {
      order_id: '80',
      status,
      company_id: ['Cancelled', 'Rejected'].includes(status) ? null : '20',
      driver_id: ['driver', 'pickup', 'deliver'].includes(action ?? '')
        ? '30'
        : null,
      updated_at: '2026-11-19T12:00:00+02:00',
    };
  }
  return envelope;
}

function errors(doc: OperationDoc): OperationObject['responses'] {
  const out: OperationObject['responses'] = {};
  const definitions: [number, string, string][] = [
    [400, 'REQUEST_FAILED', 'Invalid request body or multipart input.'],
    [
      422,
      'VALIDATION_ERROR',
      doc.tag.startsWith('15')
        ? 'Invalid file or input. Image uploads may also return INVALID_IMAGE.'
        : 'Invalid fields, ID or input values.',
    ],
    [500, 'INTERNAL_ERROR', 'Unexpected server error.'],
  ];
  if (!isPublic(doc))
    definitions.push(
      [
        401,
        'UNAUTHENTICATED',
        'Missing, invalid, expired or revoked access session.',
      ],
      [
        403,
        'FORBIDDEN',
        'Wrong role, inactive/unverified account or management blocked by restaurant activation (RESTAURANT_NOT_ACTIVE).',
      ],
    );
  if (doc.path.endsWith('/login'))
    definitions.push(
      [401, 'UNAUTHENTICATED', 'Incorrect email or password.'],
      [
        403,
        'EMAIL_NOT_VERIFIED',
        'Email verification required or account inactive (FORBIDDEN).',
      ],
    );
  if (
    doc.path.endsWith('/verify-email') ||
    doc.path.endsWith('/reset-password')
  )
    definitions.push([
      400,
      'OTP_INVALID_OR_EXPIRED',
      'The code is invalid, expired, used or locked. Request a new code after cooldown.',
    ]);
  if (doc.path.endsWith('/refresh'))
    definitions.push([
      401,
      'UNAUTHENTICATED',
      'Invalid, expired, revoked or already rotated refresh token.',
    ]);
  if (
    doc.path.includes('{') ||
    doc.path.includes('/restaurants') ||
    [
      '/api/v1/restaurant/profile',
      '/api/v1/restaurant/dashboard',
      '/api/v1/delivery-company/profile',
      '/api/v1/customer/cart/quote',
    ].includes(doc.path) ||
    (doc.path === '/api/v1/customer/orders' && doc.method === 'post')
  )
    definitions.push([
      404,
      'NOT_FOUND',
      'Record not found, not visible or not owned by the caller.',
    ]);
  if (doc.method !== 'get')
    definitions.push([
      409,
      'CONFLICT',
      'Business rule conflict: duplicate value, cart/availability/state conflict or delivery company unavailable. Read error.code and message.',
    ]);
  if (
    doc.tag.startsWith('11') ||
    (doc.tag.startsWith('12') && doc.method === 'post')
  )
    definitions.push([
      409,
      'UNAVAILABLE',
      'Cart operation conflict. Codes: CART_CONFLICT (refresh cart), CART_RESTAURANT_CONFLICT (clear cart before switching), UNAVAILABLE (refresh selections), EMPTY_CART (add items), RESTAURANT_CLOSED (restaurant is closed). Not every code applies to every cart/order action.',
    ]);
  if (
    (doc.tag.startsWith('13') || doc.tag.startsWith('14')) &&
    doc.method !== 'get'
  )
    definitions.push([
      409,
      'CONFLICT',
      'Order operation conflict. Codes: CONFLICT (invalid state), ORDER_CONFLICT (refresh order), DELIVERY_COMPANY_UNAVAILABLE (accept leaves Pending), DRIVER_REQUIRED (assign driver first), DRIVER_UNAVAILABLE (select active driver). Codes depend on the action.',
    ]);
  if (
    doc.path.startsWith('/api/v1/auth/') ||
    doc.path === '/api/v1/me/password' ||
    doc.tag.startsWith('15')
  )
    definitions.push([
      429,
      'RATE_LIMITED',
      'Too many requests or OTP resend cooldown.',
    ]);
  if (doc.tag.startsWith('15'))
    definitions.push([
      413,
      'REQUEST_FAILED',
      'File exceeds the 5 MiB limit. IMAGE_TOO_LARGE is also used by the image service.',
    ]);
  if (doc.path.endsWith('/health/ready'))
    definitions.push([503, 'NOT_READY', 'Database is unavailable.']);
  for (const [status, code, description] of definitions) {
    out[status] = {
      description,
      content: {
        'application/json': {
          schema: ref('ApiError'),
          example: {
            success: false,
            message: description,
            error: {
              code,
              ...(status === 422
                ? {
                    fields: {
                      [doc.tag.startsWith('15')
                        ? 'file'
                        : (Object.keys(doc.bodyExample ?? {})[0] ??
                          doc.path.match(/\{(\w+)\}/)?.[1] ??
                          'page')]: ['Please check this value.'],
                    },
                  }
                : {}),
            },
          },
        },
      },
    };
    if (status === 429 && doc.tag.startsWith('01'))
      out[status].headers = {
        'Retry-After': {
          description:
            'Seconds to wait when supplied by the authentication rate limiter; service cooldown errors may omit it.',
          schema: { type: 'integer', minimum: 1 },
        },
      };
  }
  return out;
}

function documentBody(doc: OperationDoc, operation: OperationObject): void {
  if (doc.tag.startsWith('15')) {
    operation.requestBody = {
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            ...object({
              file: {
                type: 'string',
                format: 'binary',
                description:
                  'One JPEG, PNG or WebP image, up to 5242880 bytes.',
              },
            }),
            additionalProperties: false,
          },
        },
      },
    };
    return;
  }
  if (!doc.bodyExample) {
    delete operation.requestBody;
    return;
  }
  const body = operation.requestBody;
  if (!body || '$ref' in body) return;
  const json = body.content['application/json'];
  if (!json) return;
  body.required = true;
  json.examples = {
    standard: {
      summary: 'Example body — replace IDs with owned records',
      value: doc.bodyExample,
    },
  };
  const schema = json.schema;
  if (!schema) return;
  if (doc.path === '/api/v1/admin/users' && doc.method === 'post')
    json.schema = {
      allOf: [schema],
      type: 'object',
      required: ['profile'],
      properties: { role: { type: 'string', enum: ['Delivery_Company'] } },
      description:
        'Successful account creation supports Delivery_Company only. Admin is syntactically recognized by the DTO but always rejected with 409; create the sole Admin through CLI.',
    };
  if (doc.path === '/api/v1/customer/cart/items' && doc.method === 'post') {
    json.schema = {
      allOf: [schema],
      oneOf: [
        {
          type: 'object',
          required: ['prod_id'],
          properties: {
            prod_id: id,
            offer_id: { type: 'string', nullable: true, enum: [null] },
          },
        },
        {
          type: 'object',
          required: ['offer_id'],
          properties: {
            offer_id: id,
            prod_id: { type: 'string', nullable: true, enum: [null] },
            addons: {
              type: 'array',
              maxItems: 0,
              items: ref('AddonChoiceDto'),
            },
          },
        },
      ],
    };
    json.examples.offer = {
      summary: 'Offer without addons',
      value: {
        rest_id: '10',
        prod_id: null,
        offer_id: '400',
        quantity: 1,
        addons: [],
      },
    };
  }
  if (
    doc.path === '/api/v1/customer/cart/quote' ||
    (doc.path === '/api/v1/customer/orders' && doc.method === 'post')
  ) {
    json.schema = {
      allOf: [schema],
      oneOf: [
        { required: ['address_id'], not: { required: ['delivery_address'] } },
        { required: ['delivery_address'], not: { required: ['address_id'] } },
      ],
    };
    json.examples.oneTimeAddress = {
      summary: 'One-time address (not saved)',
      value: {
        delivery_address: {
          address_line: '12 Main Street, Ismailia',
          longitude: '32.2723000',
          latitude: '30.5965000',
        },
        ...(doc.path.endsWith('/orders') ? { notes: 'Call on arrival' } : {}),
      },
    };
  }
}

export function createApiDocument(app: INestApplication): OpenAPIObject {
  const builder = new DocumentBuilder()
    .setTitle('AKEELA API — Mobile & Web')
    .setDescription(guide)
    .setVersion('1.0')
    .addServer('/', 'This API origin')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Paste access_token only, without the Bearer prefix. Obtain it from POST /auth/login. Refresh tokens belong in the JSON body of /auth/refresh.',
      },
      'access-token',
    );
  for (const tag of [...new Set(operations.map((d) => d.tag))])
    builder.addTag(
      tag,
      `${rules[tag.slice(0, 2)]?.split('. ')[0]}. Expand an endpoint for its full rules.`,
    );
  const document = SwaggerModule.createDocument(app, builder.build(), {
    autoTagControllers: false,
    extraModels: [
      PaginationQuery,
      ListUsersQuery,
      ListRestaurantsQuery,
      ListAddressesQuery,
      ListCategoriesQuery,
      ListProductsQuery,
      ListRestaurantProductsQuery,
      ListAddonsQuery,
      ListOffersQuery,
      ListPublicOffersFeedQuery,
      GlobalSearchQuery,
      ListDriversQuery,
      ListOrdersQuery,
      OperationalOrdersQuery,
      AdminAnalyticsQuery,
      AdminRestaurantAnalyticsQuery,
      DeliveryAnalyticsQuery,
      RestaurantAnalyticsQuery,
    ],
    operationIdFactory: (controller, method) =>
      `${controller.replace(/Controller$/, '')}_${method}`,
  });
  document.components ??= {};
  document.components.schemas = {
    ...document.components.schemas,
    ...responseModels,
  };
  for (const [name, schema] of Object.entries(document.components.schemas)) {
    if (!('$ref' in schema) && name.endsWith('Dto')) {
      schema.additionalProperties = false;
      for (const [field, property] of Object.entries(schema.properties ?? {})) {
        if (
          !('$ref' in property) &&
          ['password', 'new_password', 'current_password'].includes(field)
        ) {
          property.format = 'password';
          property.writeOnly = true;
        }
      }
    }
  }
  for (const doc of operations) {
    const operation = document.paths[doc.path]?.[doc.method as 'get'];
    if (!operation) continue; // Coverage tests require an exact controller/registry match.
    const paginated =
      doc.model.startsWith('List<') &&
      (operation.parameters ?? []).some(
        (p) => !('$ref' in p) && p.in === 'query',
      );
    operation.tags = [doc.tag];
    operation.summary = doc.summary;
    operation.description = `${doc.summary}\n\n${isPublic(doc) ? 'Access: public; no Authorization header required.' : `Access: ${doc.path.startsWith('/api/v1/me') || doc.path.endsWith('/logout') ? 'any authenticated role' : doc.path.includes('/admin/') ? 'Admin' : doc.path.includes('/delivery-company/') ? 'Delivery_Company' : doc.path.includes('/restaurant/') ? 'Restaurant' : 'Customer'}. A valid Bearer JWT and active, verified account are required.`}\n\n${rules[doc.tag.slice(0, 2)]}`;
    operation.security = isPublic(doc) ? [] : [{ 'access-token': [] }];
    operation.parameters = operation.parameters?.map((p) =>
      !('$ref' in p) && p.in === 'path'
        ? {
            ...p,
            required: true,
            schema: id,
            description:
              'Positive BIGINT record ID as a decimal string. Ownership/visibility is enforced.',
          }
        : p,
    );
    operation.responses = {
      ...errors(doc),
      [doc.status]: {
        description:
          doc.status === 201
            ? 'Created. Success envelope below.'
            : 'Success. Envelope below.',
        content: {
          'application/json': {
            schema: success(doc, paginated),
            example: example(doc, paginated),
          },
        },
      },
    };
    const successResponse = operation.responses[doc.status] as ResponseObject;
    if (
      doc.path.endsWith('/login') ||
      doc.path.endsWith('/refresh') ||
      doc.path === '/api/v1/me'
    )
      successResponse.headers = {
        'Cache-Control': {
          schema: { type: 'string', example: 'no-store' },
          description: 'Do not cache account/token responses.',
        },
      };
    documentBody(doc, operation);
  }
  return document;
}

export function configureSwagger(app: INestApplication, enabled = true): void {
  if (!enabled) return;
  const document = createApiDocument(app);
  const urls = swaggerRoles.map((role) => ({
    name: role.name,
    url: `/api/v1/docs/${role.slug}-json`,
  }));
  const options = (name: string) => ({
    useGlobalPrefix: true,
    explorer: true,
    raw: ['json'] as ['json'],
    customSiteTitle: `AKEELA — ${name} API Reference`,
    swaggerOptions: {
      urls,
      'urls.primaryName': name,
      deepLinking: false,
      persistAuthorization: false,
      validatorUrl: null,
      docExpansion: 'none',
      filter: true,
      displayRequestDuration: true,
      defaultModelsExpandDepth: -1,
      // Keep the workflow order from each role document, rather than alphabetic tags.
    },
  });
  for (const role of swaggerRoles) {
    SwaggerModule.setup(
      `docs/${role.slug}`,
      app,
      createRoleDocument(document, role),
      options(role.name),
    );
  }
  // Preserve the full JSON URL for existing imports, while the UI starts in Customer.
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    ui: false,
    raw: ['json'],
  });
  SwaggerModule.setup(
    'docs',
    app,
    createRoleDocument(document, swaggerRoles[0]),
    { ...options('Customer'), raw: false },
  );
}
