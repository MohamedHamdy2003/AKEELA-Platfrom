import { ViewEntity, ViewColumn } from 'typeorm';
export const HISTORY_SQL =
  "SELECT order_id, customer_id, rest_id, status, customer_address, delivery_fee, total_price, created_at, updated_at FROM orders WHERE status IN ('Delivered', 'Rejected', 'Cancelled', 'Failed')";
@ViewEntity({ name: 'orders_history', expression: HISTORY_SQL })
export class OrdersHistory {
  @ViewColumn() order_id!: string;
  @ViewColumn() customer_id!: string;
  @ViewColumn() rest_id!: string;
  @ViewColumn() status!: string;
  @ViewColumn() customer_address!: string;
  @ViewColumn() delivery_fee!: string;
  @ViewColumn() total_price!: string;
  @ViewColumn() created_at!: Date;
  @ViewColumn() updated_at!: Date;
}
