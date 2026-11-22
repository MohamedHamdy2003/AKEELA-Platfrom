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
  product_count?: number;
}
export interface Product {
  prod_id: string;
  cat_id: string | null;
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
  linked_product_ids?: string[];
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
export const statusDescriptions: Record<OrderStatus, string> = {
  Pending: 'بانتظار القبول: تم استلام الطلب من العميل وفي انتظار قبول المطعم.',
  Accepted: 'مقبول: وافق المطعم على الطلب، وجارٍ تحضيره وإسناده للتوصيل.',
  Picked_Up:
    'قيد التوصيل: استلم السائق الطلب من المطعم وهو في الطريق إلى العميل.',
  Delivered: 'تم التوصيل: تم توصيل الطلب بنجاح إلى العميل واكتمال الدورة.',
  Rejected: 'مرفوض: اعتذر المطعم عن قبول الطلب لعدم توفر الأصناف أو ضغط العمل.',
  Cancelled: 'ملغي: قام العميل بإلغاء الطلب قبل بدء المطعم في تحضيره.',
  Failed: 'تعذّر التوصيل: تعذر إكمال الطلب لعائق تشغيلي.',
};
export type OrderStatus = keyof typeof statuses;
export type AnalyticsRange = 'today' | '7d' | '30d' | '90d' | 'all';
export interface RestaurantAnalytics {
  range: AnalyticsRange;
  generated_at: string;
  kpis: {
    food_revenue: string;
    gross_gmv: string;
    addons_revenue: string;
    avg_order_value: string;
    total_orders: number;
    delivered_orders: number;
    rejected_orders: number;
    cancelled_orders: number;
    acceptance_rate: number;
    completion_rate: number;
    rejection_rate: number;
    cancellation_rate: number;
    unique_customers: number;
    repeat_customers: number;
    repeat_customer_rate: number;
    avg_fulfillment_minutes: number | null;
  };
  previous_kpis: {
    food_revenue: string;
    addons_revenue: string;
    avg_order_value: string;
    total_orders: number;
    delivered_orders: number;
    avg_fulfillment_minutes: number | null;
  } | null;
  live_alerts: {
    pending_orders: number;
    stale_pending_orders: number;
    active_in_progress: number;
    inactive_products: number;
    expiring_offers: number;
  };
  status_breakdown: Record<OrderStatus, number>;
  daily_series: Array<{
    date: string;
    orders: number;
    delivered: number;
    food_revenue: string;
  }>;
  peak_hours: Array<{
    hour: number;
    orders: number;
  }>;
  menu_totals: {
    active_categories: number;
    active_products: number;
    inactive_products: number;
    active_addons: number;
    active_offers: number;
  };
  top_items: Array<{
    item_name: string;
    item_type: 'product' | 'offer';
    units_sold: number;
    revenue: string;
    share_pct: number;
  }>;
  slow_items: Array<{
    prod_id: string;
    prod_name: string;
    cat_title: string;
    price: string;
    units_sold: number;
  }>;
  top_addons: Array<{
    addon_name: string;
    units_sold: number;
    revenue: string;
  }>;
  category_breakdown: Array<{
    cat_title: string;
    units_sold: number;
    revenue: string;
    share_pct: number;
  }>;
}
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
