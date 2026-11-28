export interface CartAddonView {
  addon_id: string;
  addon_name: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}
export interface CartItemView {
  cart_item_id: string;
  prod_id: string | null;
  offer_id: string | null;
  item_name: string;
  item_image_url: string | null;
  quantity: number;
  unit_price: string;
  subtotal: string;
  addons: CartAddonView[];
  line_total: string;
  is_available: boolean;
}
export interface CartView {
  cart_id: string | null;
  rest_id: string | null;
  rest_title: string | null;
  rest_image_url_mobile: string | null;
  items: CartItemView[];
  items_subtotal: string;
  addons_subtotal: string;
  subtotal: string;
  updated_at: string | null;
}
export const GENERAL_DELIVERY_FEE = '30.00';
