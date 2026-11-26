export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Meta;
  error?: { code: string; fields?: Record<string, string[]> };
}
export interface Meta {
  page: number;
  per_page: number;
  total: number;
  last_page: number;
}
export interface Tokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in: number;
}
export interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  is_active: boolean;
  email_verified_at: string | null;
  profile: Record<string, unknown>;
}
export type OrderStatus =
  | 'Pending'
  | 'Accepted'
  | 'Picked_Up'
  | 'Delivered'
  | 'Rejected'
  | 'Cancelled'
  | 'Failed';
export type OrderStatusCounts = Record<OrderStatus, number>;
export type AnalyticsRange = 'today' | '7d' | '30d' | '90d' | 'all';
export interface AdminAnalyticsKpis {
  delivered_gmv: string;
  delivery_fees_total: string;
  avg_order_value: string;
  total_orders: number;
  delivered_orders: number;
  completion_rate: number;
  rejection_rate: number;
  cancellation_rate: number;
  failure_rate: number;
  new_customers: number;
  new_restaurants: number;
}
export interface AdminAnalyticsPreviousKpis {
  delivered_gmv: string;
  delivery_fees_total: string;
  avg_order_value: string;
  total_orders: number;
  delivered_orders: number;
  new_customers: number;
  new_restaurants: number;
}
export interface AdminAnalyticsDailyPoint {
  date: string;
  orders: number;
  delivered: number;
  gmv: string;
}
export interface AdminAnalyticsHourPoint {
  hour: number;
  orders: number;
}
export interface AdminAnalyticsRestaurant {
  rest_id: string;
  rest_title: string;
  total_orders: number;
  delivered_orders: number;
  rejected_orders: number;
  rejection_rate: number;
  gmv: string;
}
export interface AdminAnalyticsTopItem {
  rest_id: string;
  rest_title: string;
  item_name: string;
  units_sold: number;
  revenue: string;
}
export interface AdminAnalytics {
  range: AnalyticsRange;
  generated_at: string;
  kpis: AdminAnalyticsKpis;
  previous_kpis: AdminAnalyticsPreviousKpis | null;
  status_breakdown: OrderStatusCounts;
  daily_series: AdminAnalyticsDailyPoint[];
  peak_hours: AdminAnalyticsHourPoint[];
  top_restaurants: AdminAnalyticsRestaurant[];
  attention_restaurants: AdminAnalyticsRestaurant[];
  top_items: AdminAnalyticsTopItem[];
  alerts: {
    stale_pending_orders: number;
    stale_accepted_orders: number;
    pending_restaurants: number;
    unverified_companies: number;
  };
  platform_totals: {
    total_users: number;
    customers: number;
    restaurants_total: number;
    restaurants_active: number;
    restaurants_pending: number;
    restaurants_suspended: number;
    delivery_companies: number;
    active_drivers: number;
    inactive_drivers: number;
  };
}
export interface DeliveryAnalyticsKpis {
  delivery_fees_earned: string;
  avg_delivery_fee: string;
  cod_collected_value: string;
  assigned_orders: number;
  delivered_orders: number;
  failed_orders: number;
  delivery_success_rate: number;
  failure_rate: number;
  avg_fulfillment_minutes: number | null;
}
export interface DeliveryAnalyticsPreviousKpis {
  delivery_fees_earned: string;
  cod_collected_value: string;
  assigned_orders: number;
  delivered_orders: number;
  failed_orders: number;
  avg_fulfillment_minutes: number | null;
}
export interface DeliveryAnalyticsLiveQueue {
  unassigned_accepted: number;
  in_transit: number;
  stale_unassigned: number;
  long_in_transit: number;
  inactive_driver_orders: number;
}
export interface DeliveryAnalyticsStatusBreakdown {
  Accepted: number;
  Picked_Up: number;
  Delivered: number;
  Failed: number;
}
export interface DeliveryAnalyticsDailyPoint {
  date: string;
  assigned: number;
  delivered: number;
  failed: number;
  delivery_fees: string;
}
export interface DeliveryAnalyticsDriver {
  driver_id: string;
  driver_name: string;
  driver_phone: string;
  is_active: boolean;
  current_load: number;
  delivered_orders: number;
  failed_orders: number;
  delivery_fees: string;
  avg_fulfillment_minutes: number | null;
  success_rate: number;
}
export interface DeliveryAnalyticsRestaurant {
  rest_id: string;
  rest_title: string;
  assigned_orders: number;
  delivered_orders: number;
  failed_orders: number;
  delivery_fees: string;
}
export interface DeliveryAnalytics {
  range: AnalyticsRange;
  generated_at: string;
  kpis: DeliveryAnalyticsKpis;
  previous_kpis: DeliveryAnalyticsPreviousKpis | null;
  live_queue: DeliveryAnalyticsLiveQueue;
  status_breakdown: DeliveryAnalyticsStatusBreakdown;
  daily_series: DeliveryAnalyticsDailyPoint[];
  peak_hours: AdminAnalyticsHourPoint[];
  fleet: {
    total_drivers: number;
    active_drivers: number;
    inactive_drivers: number;
    busy_drivers: number;
    idle_active_drivers: number;
  };
  driver_leaderboard: DeliveryAnalyticsDriver[];
  top_pickup_restaurants: DeliveryAnalyticsRestaurant[];
}
export interface AdminRestaurantAnalyticsDailyPoint {
  date: string;
  orders: number;
  delivered: number;
  food_revenue: string;
  delivery_fees: string;
  gross_gmv: string;
}
export interface AdminRestaurantAnalytics {
  range: AnalyticsRange | 'custom';
  date_from?: string | null;
  date_to?: string | null;
  generated_at: string;
  kpis: {
    food_revenue: string;
    delivery_fees_total: string;
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
  status_breakdown: OrderStatusCounts;
  daily_series: AdminRestaurantAnalyticsDailyPoint[];
  peak_hours: AdminAnalyticsHourPoint[];
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
export const statuses: Record<OrderStatus, string> = {
  Pending: 'قيد الانتظار',
  Accepted: 'مقبول',
  Picked_Up: 'قيد التوصيل',
  Delivered: 'تم التسليم',
  Rejected: 'مرفوض',
  Cancelled: 'ملغي',
  Failed: 'متعثر',
};
export const deliveryStatuses: Record<OrderStatus, string> = {
  ...statuses,
  Accepted: 'بانتظار سائق',
};
export const statusDescriptions: Record<OrderStatus, string> = {
  Pending:
    'قيد الانتظار: تم إنشاء الطلب من العميل وفي انتظار مراجعة وقبول المطعم.',
  Accepted: 'مقبول: وافق المطعم على الطلب، وجارٍ تحضيره وإسناده للتوصيل.',
  Picked_Up:
    'قيد التوصيل: استلم السائق الطلب من المطعم وهو في طريقه إلى العميل.',
  Delivered: 'تم التسليم: تم توصيل الطلب بنجاح إلى العميل واكتمال الدورة.',
  Rejected: 'مرفوض: اعتذر المطعم عن قبول الطلب لعدم توفر الأصناف أو ضغط العمل.',
  Cancelled: 'ملغي: قام العميل بإلغاء الطلب قبل بدء المطعم في تحضيره.',
  Failed: 'متعثر: تعذر إكمال الطلب لعائق تشغيلي يستوجب تدخل الإدارة.',
};
export const deliveryStatusDescriptions: Record<OrderStatus, string> = {
  ...statusDescriptions,
  Accepted:
    'بانتظار سائق: وافق المطعم على الطلب وهو جاهز لإسناد سائق لبدء التوصيل.',
};
export interface OrderSummary {
  order_id: string;
  rest_id: string;
  company_id: string | null;
  driver_id: string | null;
  status: OrderStatus;
  total_price: string;
  created_at: string;
  updated_at: string;
}
export interface Order extends OrderSummary {
  customer_id: string;
  customer_address: string;
  delivery_longitude: string;
  delivery_latitude: string;
  delivery_fee: string;
  notes: string | null;
  items: Array<{
    order_item_id: string;
    item_name: string;
    quantity: number;
    unit_price: string;
    subtotal: string;
    addons: Array<{
      order_item_addon_id: string;
      addon_name: string;
      quantity: number;
      unit_price: string;
      subtotal: string;
    }>;
  }>;
  pickup?: {
    rest_title: string;
    rest_address: string;
    longitude: string;
    latitude: string;
  };
}
export interface Driver {
  driver_id: string;
  company_id: string;
  driver_name: string;
  driver_phone: string;
  driver_email: string | null;
  is_active: boolean;
}
export interface Company {
  company_id: string;
  company_name: string;
  company_phone: string;
  company_email: string | null;
  company_address: string;
  is_active: boolean;
}
export interface RestaurantReview {
  owner: Pick<
    User,
    | 'user_id'
    | 'full_name'
    | 'email'
    | 'phone'
    | 'email_verified_at'
    | 'is_active'
  > | null;
  profile: {
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
    activation_status: 'Pending' | 'Active' | 'Suspended';
  };
}
