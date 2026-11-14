export type Activation = 'Pending' | 'Active' | 'Suspended';
export interface Profile {
  rest_id: string;
  rest_title: string;
  rest_description: string | null;
  rest_address: string;
  longitude: string;
  latitude: string;
  opens_at: string;
  closes_at: string;
  rest_image_url_mobile: string | null;
  is_active: boolean;
  activation_status: Activation;
}
export interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  profile: Profile;
}
export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
}
export interface Dashboard {
  rest_id: string;
  activation_status: Activation;
  can_manage: boolean;
  message: string;
}
export interface Meta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}
export interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
  meta?: Meta;
  error?: { code: string; fields?: Record<string, string[]> };
}
export interface Category {
  cat_id: string;
  cat_title: string;
  display_order: number;
  is_active: boolean;
}
export interface Product {
  prod_id: string;
  cat_id: string;
  prod_name: string;
  prod_description: string | null;
  prod_image_url: string | null;
  price: string;
  is_active: boolean;
}
export interface Addon {
  addon_id: string;
  addon_name: string;
  addon_price: string;
  is_active: boolean;
}
export interface ProductAddon {
  addon_id: string;
  is_active: boolean;
  addon: Addon;
}
export interface Offer {
  offer_id: string;
  offer_title: string;
  offer_description: string | null;
  offer_image_url: string | null;
  initial_price: string;
  real_price: string;
  starts_at: string;
  expires_at: string;
  is_active: boolean;
}
export type CatalogKind = 'categories' | 'products' | 'addons' | 'offers';
export type CatalogRecord = Category | Product | Addon | Offer;
export const statuses = {
  Pending: 'بانتظار القبول',
  Accepted: 'مقبول',
  Picked_Up: 'قيد التوصيل',
  Delivered: 'تم التوصيل',
  Rejected: 'مرفوض',
  Cancelled: 'ملغي',
  Failed: 'تعذّر التوصيل',
} as const;
export type OrderStatus = keyof typeof statuses;
export interface OrderSummary {
  order_id: string;
  status: OrderStatus;
  total_price: string;
  created_at: string;
  company_id: string | null;
  driver_id: string | null;
}
export interface Order extends OrderSummary {
  customer_address: string;
  delivery_longitude: string;
  delivery_latitude: string;
  delivery_fee: string;
  notes: string | null;
  items: {
    order_item_id: string;
    item_name: string;
    quantity: number;
    unit_price: string;
    subtotal: string;
    addons: {
      order_item_addon_id: string;
      addon_name: string;
      quantity: number;
      unit_price: string;
      subtotal: string;
    }[];
  }[];
}
