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
export const statuses: Record<OrderStatus, string> = {
  Pending: 'قيد الانتظار',
  Accepted: 'مقبول',
  Picked_Up: 'قيد التوصيل',
  Delivered: 'تم التسليم',
  Rejected: 'مرفوض',
  Cancelled: 'ملغي',
  Failed: 'متعثر',
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
