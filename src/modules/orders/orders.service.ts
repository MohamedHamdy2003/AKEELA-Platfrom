import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { CartService } from '../cart/cart.service';
import { CheckoutDto, ListOrdersQuery } from './orders.dto';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { paginationMeta, resolvePagination } from '../users/admin.dto';
const FINAL = ['Delivered', 'Rejected', 'Cancelled', 'Failed'];
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DataSource,
    private readonly cart: CartService,
  ) {}
  private summary(order: Order) {
    return {
      order_id: order.order_id,
      rest_id: order.rest_id,
      status: order.status,
      company_id: order.company_id,
      driver_id: order.driver_id,
      total_price: order.total_price,
      created_at: order.created_at,
      updated_at: order.updated_at,
    };
  }
  async details(
    userId: string,
    orderId: string,
    m: EntityManager = this.db.manager,
  ) {
    const order = await m
      .getRepository(Order)
      .findOneBy({ order_id: orderId, customer_id: userId });
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');
    const rows = await m
      .getRepository(OrderItem)
      .find({ where: { order_id: orderId }, order: { order_item_id: 'ASC' } });
    const items = [];
    for (const item of rows) {
      const addons = await m.getRepository(OrderItemAddon).find({
        where: { order_item_id: item.order_item_id },
        order: { order_item_addon_id: 'ASC' },
      });
      items.push({
        order_item_id: item.order_item_id,
        prod_id: item.prod_id,
        offer_id: item.offer_id,
        item_name: item.item_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        subtotal: item.subtotal,
        addons: addons.map((a) => ({
          order_item_addon_id: a.order_item_addon_id,
          addon_id: a.addon_id,
          addon_name: a.addon_name,
          unit_price: a.unit_price,
          quantity: a.quantity,
          subtotal: a.subtotal,
        })),
      });
    }
    return {
      ...this.summary(order),
      customer_id: order.customer_id,
      customer_address: order.customer_address,
      delivery_longitude: order.delivery_longitude,
      delivery_latitude: order.delivery_latitude,
      delivery_fee: order.delivery_fee,
      notes: order.notes,
      items,
    };
  }
  async checkout(userId: string, input: CheckoutDto) {
    return this.cart.transaction(userId, async (m) => {
      const ready = await this.cart.ready(userId, input, m);
      const order = await m.getRepository(Order).save(
        m.getRepository(Order).create({
          customer_id: userId,
          rest_id: ready.cart.rest_id!,
          company_id: null,
          driver_id: null,
          status: 'Pending',
          customer_address: ready.address.address_line,
          delivery_longitude: ready.address.longitude,
          delivery_latitude: ready.address.latitude,
          delivery_fee: ready.delivery_fee,
          total_price: ready.total_price,
          notes: input.notes ?? null,
        }),
      );
      for (const row of ready.cart.items) {
        const item = await m.getRepository(OrderItem).save(
          m.getRepository(OrderItem).create({
            order_id: order.order_id,
            rest_id: order.rest_id,
            prod_id: row.prod_id,
            offer_id: row.offer_id,
            item_name: row.item_name,
            unit_price: row.unit_price,
            quantity: row.quantity,
          }),
        );
        if (row.addons.length)
          await m.getRepository(OrderItemAddon).save(
            row.addons.map((a) => ({
              order_item_id: item.order_item_id,
              rest_id: order.rest_id,
              prod_id: row.prod_id!,
              addon_id: a.addon_id,
              addon_name: a.addon_name,
              unit_price: a.unit_price,
              quantity: a.quantity,
            })),
          );
      }
      await this.cart.clearInTransaction(userId, m);
      return this.details(userId, order.order_id, m);
    });
  }
  async list(userId: string, query: ListOrdersQuery) {
    const page = resolvePagination(query);
    const qb = this.db
      .getRepository(Order)
      .createQueryBuilder('o')
      .where('o.customer_id = :userId', { userId });
    if (query.status)
      qb.andWhere('o.status = :status', { status: query.status });
    if (query.scope)
      qb.andWhere(
        query.scope === 'history'
          ? 'o.status IN (:...final)'
          : 'o.status NOT IN (:...final)',
        { final: FINAL },
      );
    const [rows, total] = await qb
      .orderBy('o.created_at', 'DESC')
      .addOrderBy('o.order_id', 'DESC')
      .skip(page.skip)
      .take(page.take)
      .getManyAndCount();
    return {
      items: rows.map((o) => this.summary(o)),
      meta: paginationMeta(total, page.page, page.per_page),
    };
  }
  async cancel(userId: string, id: string) {
    return this.cart.transaction(userId, async (m) => {
      const repo = m.getRepository(Order);
      const order = await repo
        .createQueryBuilder('o')
        .where('o.customer_id = :userId AND o.order_id = :id', { userId, id })
        .setLock('pessimistic_write')
        .getOne();
      if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');
      if (order.status !== 'Pending')
        throw new ApiError(
          409,
          'CONFLICT',
          'Only Pending orders can be cancelled.',
        );
      order.status = 'Cancelled';
      const saved = await repo.save(order);
      return {
        order_id: saved.order_id,
        status: saved.status,
        company_id: saved.company_id,
        driver_id: saved.driver_id,
        updated_at: saved.updated_at,
      };
    });
  }
}
