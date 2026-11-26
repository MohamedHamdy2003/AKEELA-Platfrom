import {
  OpenAPIObject,
  OperationObject,
  PathItemObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { responseExamples } from './examples';

export const swaggerRoles = [
  { slug: 'customer', name: 'Customer', prefix: '/api/v1/customer/' },
  { slug: 'restaurant', name: 'Restaurant', prefix: '/api/v1/restaurant/' },
  { slug: 'admin', name: 'Admin', prefix: '/api/v1/admin/' },
  {
    slug: 'delivery-company',
    name: 'Delivery Company',
    prefix: '/api/v1/delivery-company/',
  },
] as const;
export type SwaggerRole = (typeof swaggerRoles)[number];

const sharedAuth = new Set([
  '/api/v1/auth/verify-email',
  '/api/v1/auth/resend-verification',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/auth/forgot-password',
  '/api/v1/auth/reset-password',
]);
const methods = ['get', 'post', 'patch', 'put', 'delete'] as const;
const groupOrder = [
  'Authentication',
  'My Profile',
  'Dashboard',
  'Addresses',
  'Users',
  'Restaurants',
  'Restaurant Profile',
  'Company Profile',
  'Categories',
  'Products',
  'Addons',
  'Product Addons',
  'Offers',
  'Cart',
  'Orders',
  'Drivers',
  'Images',
  'Notifications',
  'Health',
];

function belongsToRole(path: string, role: SwaggerRole): boolean {
  if (
    sharedAuth.has(path) ||
    path === '/api/v1/me' ||
    path === '/api/v1/me/password' ||
    path === '/api/v1/me/device-tokens' ||
    path.startsWith('/api/v1/me/device-tokens/') ||
    path.startsWith('/api/v1/health/')
  )
    return true;
  if (
    role.slug === 'customer' &&
    (path === '/api/v1/auth/register' ||
      path === '/api/v1/restaurants' ||
      path.startsWith('/api/v1/restaurants/'))
  )
    return true;
  if (role.slug === 'restaurant' && path === '/api/v1/auth/register/restaurant')
    return true;
  return path.startsWith(role.prefix) || path === role.prefix.slice(0, -1);
}

function feature(path: string): string {
  if (path.startsWith('/api/v1/auth/') || path === '/api/v1/me/password')
    return 'Authentication';
  if (path === '/api/v1/me') return 'My Profile';
  if (
    path === '/api/v1/me/device-tokens' ||
    path.startsWith('/api/v1/me/device-tokens/') ||
    path.includes('/notifications')
  )
    return 'Notifications';
  if (path.startsWith('/api/v1/health/')) return 'Health';
  if (path.endsWith('/image') || path.endsWith('/avatar')) return 'Images';
  if (path.includes('/orders')) return 'Orders';
  if (path.includes('/cart')) return 'Cart';
  if (path.endsWith('/dashboard') || path.endsWith('/analytics'))
    return 'Dashboard';
  if (path === '/api/v1/restaurant/profile') return 'Restaurant Profile';
  if (path === '/api/v1/delivery-company/profile') return 'Company Profile';
  if (path.includes('/addresses')) return 'Addresses';
  if (path.includes('/drivers')) return 'Drivers';
  if (path.includes('/users')) return 'Users';
  if (path.includes('/categories')) return 'Categories';
  if (path.includes('/products/') && path.includes('/addons'))
    return 'Product Addons';
  if (path.includes('/products')) return 'Products';
  if (path.includes('/addons')) return 'Addons';
  if (path.includes('/offers')) return 'Offers';
  return 'Restaurants';
}

// Keep client imports focused and ensure every local schema reference still resolves.
function pruneSchemas(document: OpenAPIObject): void {
  const all = document.components?.schemas ?? {};
  const needed = new Set<string>();
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (
      '$ref' in value &&
      typeof value.$ref === 'string' &&
      value.$ref.startsWith('#/components/schemas/')
    ) {
      const name = value.$ref.slice('#/components/schemas/'.length);
      if (!needed.has(name)) {
        needed.add(name);
        visit(all[name]);
      }
    }
    for (const child of Object.values(value)) visit(child);
  };
  visit(document.paths);
  document.components!.schemas = Object.fromEntries(
    Object.entries(all).filter(([name]) => needed.has(name)),
  );
}

function accountExample(role: SwaggerRole): Record<string, unknown> {
  const customer = structuredClone(responseExamples.User) as Record<
    string,
    unknown
  >;
  if (role.slug === 'customer') return customer;
  if (role.slug === 'restaurant') {
    const owner = structuredClone(
      responseExamples.UnverifiedRestaurantUser,
    ) as Record<string, unknown>;
    owner.email_verified_at = customer.email_verified_at;
    (owner.profile as Record<string, unknown>).activation_status = 'Active';
    return owner;
  }
  if (role.slug === 'delivery-company') {
    const profile = structuredClone(responseExamples.CompanyProfile) as Record<
      string,
      unknown
    >;
    return {
      ...customer,
      user_id: profile.user_id,
      role: 'Delivery_Company',
      full_name: 'Company Owner',
      email: 'company@example.com',
      phone: profile.company_phone,
      profile: { ...profile, profile_role: 'Delivery_Company' },
    };
  }
  return {
    ...customer,
    role: 'Admin',
    full_name: 'Platform Admin',
    email: 'admin@example.com',
    profile: {
      user_id: customer.user_id,
      profile_role: 'Admin',
      created_at: customer.created_at,
      updated_at: customer.updated_at,
    },
  };
}

export function createRoleDocument(
  source: OpenAPIObject,
  role: SwaggerRole,
): OpenAPIObject {
  const document = structuredClone(source);
  document.info.title = `AKEELA API — ${role.name}`;
  const onboarding =
    role.slug === 'customer'
      ? 'Register as a Customer, verify the email OTP, then log in. Browse the public menu without a token.'
      : role.slug === 'restaurant'
        ? 'Register as a Restaurant owner, verify the email OTP, then log in. Admin must activate the restaurant before management.'
        : role.slug === 'admin'
          ? 'The single Admin is created through CLI. Log in with that account; public Admin registration is not supported. Admin can create Delivery Company accounts and review restaurants.'
          : 'Admin creates the Delivery Company account. Verify the email OTP, then log in. Drivers do not have login accounts.';
  document.info.description = `**${role.name} reference.** Choose a role in the top selector or open its direct documentation URL. Feature groups below contain only this client’s endpoints. Shared authentication, own-account and health routes appear in each reference. This is documentation organization; server authorization and the actual API URLs are unchanged.\n\n${source.info.description?.replace(/### Start here[\s\S]*?(?=### Data and errors)/, `### Start here\n${onboarding}\n\nUse **Authorize** with the access token alone. Protected requests send Authorization: Bearer <access_token>. Refresh through POST /auth/refresh with the rotating JSON refresh_token.\n\n`) ?? ''}`;
  document.info.description = document.info.description.replace(
    '### Mobile integration',
    '### Client integration',
  );
  if (role.slug !== 'customer')
    document.info.description = document.info.description.replace(
      /^- Checkout[^\n]*\n/gm,
      '',
    );
  if (role.slug === 'admin' || role.slug === 'delivery-company')
    document.info.description = document.info.description.replace(
      /^- Upload[^\n]*\n/gm,
      '',
    );
  document.paths = {};
  const groups = new Set<string>();
  for (const [path, item] of Object.entries(source.paths)) {
    if (!belongsToRole(path, role)) continue;
    const scoped: PathItemObject = structuredClone(item);
    for (const method of methods) {
      const operation = scoped[method] as OperationObject | undefined;
      if (!operation) continue;
      const group = feature(path);
      operation.tags = [group];
      groups.add(group);
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!status.startsWith('2') || !response || '$ref' in response)
          continue;
        const sample = response.content?.['application/json']?.example as
          { data?: Record<string, unknown> } | undefined;
        if (sample?.data && path === '/api/v1/auth/login')
          sample.data.user = accountExample(role);
        if (sample?.data && path === '/api/v1/me')
          sample.data = accountExample(role);
        if (sample?.data && path === '/api/v1/admin/users' && method === 'post')
          sample.data = {
            ...accountExample(swaggerRoles[3]),
            email_verified_at: null,
          };
      }
      // Other roles cannot submit the Customer-only avatar field to PATCH /me.
      if (
        role.slug !== 'customer' &&
        path === '/api/v1/me' &&
        method === 'patch'
      ) {
        const body = operation.requestBody;
        if (body && !('$ref' in body)) {
          for (const example of Object.values(
            body.content['application/json']?.examples ?? {},
          )) {
            if (
              !('$ref' in example) &&
              example.value &&
              typeof example.value === 'object'
            )
              delete example.value.cus_avatar_url;
          }
        }
      }
    }
    document.paths[path] = scoped;
  }
  if (role.slug !== 'customer') {
    const patch = document.components?.schemas?.PatchMeDto as
      SchemaObject | undefined;
    if (patch?.properties) delete patch.properties.cus_avatar_url;
  }
  document.tags = groupOrder
    .filter((group) => groups.has(group))
    .map((name) => ({ name }));
  pruneSchemas(document);
  return document;
}
