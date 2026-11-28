import { OrderEventsGateway, OrderEvent } from './order-events.gateway';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DeliveryService } from '../delivery/delivery.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { CartService } from '../cart/cart.service';
import {
  CheckoutDto,
  ListOrdersQuery,
  OperationalOrdersQuery,
} from './orders.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemAddon } from './entities/order-item-addon.entity';
import { paginationMeta, resolvePagination } from '../users/admin.dto';
const FINAL = ['Delivered', 'Rejected', 'Cancelled', 'Failed'];
@Injectable()
export class OrdersService {
  constructor(
    private readonly db: DataSource,
    private readonly cart: CartService,
    private readonly users: UsersService,
    private readonly restaurants: RestaurantsService,
    private readonly delivery: DeliveryService,
    private readonly events: OrderEventsGateway,
    private readonly notifications: NotificationsService,
  ) {}
  private async announce(order: Order, event: OrderEvent) {
    try {
      await this.events.notify(event, order);
      void this.notifications.notifyOrderEvent(event, order);
    } catch {
      this.events.reportFailure();
    }
  }
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
    return this.renderDetails(order, m);
  }
  private async renderDetails(order: Order, m: EntityManager) {
    const orderId = order.order_id;
    const rows = await m
      .getRepository(OrderItem)
      .find({ where: { order_id: orderId }, order: { order_item_id: 'ASC' } });
    const itemIds = rows.map((row) => row.order_item_id);
    const allAddons = itemIds.length
      ? await m.getRepository(OrderItemAddon).find({
          where: { order_item_id: In(itemIds) },
          order: { order_item_addon_id: 'ASC' },
        })
      : [];
    const addonsByItem = new Map<string, OrderItemAddon[]>();
    for (const addon of allAddons) {
      const list = addonsByItem.get(addon.order_item_id);
      if (list) list.push(addon);
      else addonsByItem.set(addon.order_item_id, [addon]);
    }
    const items = rows.map((item) => {
      const addons = addonsByItem.get(item.order_item_id) ?? [];
      return {
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
      };
    });
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
    const result = await this.cart.transaction(userId, async (m) => {
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
      const itemRepo = m.getRepository(OrderItem);
      const savedItems = await itemRepo.save(
        ready.cart.items.map((row) =>
          itemRepo.create({
            order_id: order.order_id,
            rest_id: order.rest_id,
            prod_id: row.prod_id,
            offer_id: row.offer_id,
            item_name: row.item_name,
            unit_price: row.unit_price,
            quantity: row.quantity,
          }),
        ),
      );
      const allAddonRows = ready.cart.items.flatMap((row, idx) =>
        row.addons.map((a) => ({
          order_item_id: savedItems[idx]!.order_item_id,
          rest_id: order.rest_id,
          prod_id: row.prod_id!,
          addon_id: a.addon_id,
          addon_name: a.addon_name,
          unit_price: a.unit_price,
          quantity: a.quantity,
        })),
      );
      if (allAddonRows.length) {
        await m.getRepository(OrderItemAddon).save(allAddonRows);
      }
      await this.cart.clearInTransaction(userId, m);
      return {
        order,
        view: await this.details(userId, order.order_id, m),
      };
    });
    void this.announce(result.order, 'order.created');
    return result.view;
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

  private assertRole(
    actor: AuthActor,
    role: 'Restaurant' | 'Delivery_Company' | 'Admin',
  ) {
    if (actor.role !== role)
      throw new ApiError(
        403,
        'FORBIDDEN',
        `${role.replace('_', ' ')} access required.`,
      );
  }
  private async scope(actor: AuthActor, m: EntityManager, lock = false) {
    if (!['Restaurant', 'Delivery_Company', 'Admin'].includes(actor.role))
      throw new ApiError(403, 'FORBIDDEN', 'Order management access required.');
    const account = await this.users.byId(actor.userId, m, lock);
    if (
      !account ||
      account.role !== actor.role ||
      !account.is_active ||
      !account.email_verified_at
    )
      throw new ApiError(
        403,
        'FORBIDDEN',
        'An active verified account is required.',
      );
    if (actor.role === 'Restaurant')
      return {
        restId: await this.restaurants.forOrderHandling(actor.userId, m, lock),
        companyId: null,
      };
    if (actor.role === 'Delivery_Company') {
      const company = await this.delivery.ownedProfile(actor.userId, m);
      if (!company.is_active)
        throw new ApiError(
          403,
          'DELIVERY_COMPANY_INACTIVE',
          'Delivery company service is not active.',
        );
      return { restId: null, companyId: company.company_id };
    }
    return { restId: null, companyId: null };
  }
  private scopedQuery(
    scope: { restId: string | null; companyId: string | null },
    m: EntityManager,
  ) {
    const qb = m.getRepository(Order).createQueryBuilder('o');
    if (scope.restId)
      qb.andWhere('o.rest_id = :restId', { restId: scope.restId });
    if (scope.companyId)
      qb.andWhere('o.company_id = :companyId', { companyId: scope.companyId });
    return qb;
  }
  async operationalList(actor: AuthActor, query: OperationalOrdersQuery) {
    const scope = await this.scope(actor, this.db.manager);
    const page = resolvePagination(query);
    if (query.date_from && query.date_to && query.date_from > query.date_to)
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Start date must not be after end date.',
      );
    const qb = this.scopedQuery(scope, this.db.manager);
    if (actor.role === 'Admin' && query.rest_id)
      qb.andWhere('o.rest_id = :filterRestId', { filterRestId: query.rest_id });
    if (query.status)
      qb.andWhere('o.status = :status', { status: query.status });
    if (query.date_from)
      qb.andWhere(
        "o.created_at >= (CAST(:date_from AS date)::timestamp AT TIME ZONE 'Africa/Cairo')",
        { date_from: query.date_from },
      );
    if (query.date_to)
      qb.andWhere(
        "o.created_at < ((CAST(:date_to AS date) + 1)::timestamp AT TIME ZONE 'Africa/Cairo')",
        { date_to: query.date_to },
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
  async operationalCounts(
    actor: AuthActor,
  ): Promise<Record<OrderStatus, number>> {
    const scope = await this.scope(actor, this.db.manager);
    const rows = await this.scopedQuery(scope, this.db.manager)
      .select('o.status', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('o.status')
      .getRawMany<{ status: OrderStatus; count: number }>();
    const counts: Record<OrderStatus, number> = {
      Pending: 0,
      Accepted: 0,
      Picked_Up: 0,
      Delivered: 0,
      Rejected: 0,
      Cancelled: 0,
      Failed: 0,
    };
    for (const row of rows) {
      if (row.status in counts) counts[row.status] = Number(row.count);
    }
    return counts;
  }
  async operationalDetails(actor: AuthActor, id: string) {
    const scope = await this.scope(actor, this.db.manager);
    const order = await this.scopedQuery(scope, this.db.manager)
      .andWhere('o.order_id = :id', { id })
      .getOne();
    if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');
    const data = await this.renderDetails(order, this.db.manager);
    if (actor.role !== 'Delivery_Company') return data;
    const pickup = await this.restaurants.profileById(order.rest_id);
    if (!pickup)
      throw new ApiError(404, 'NOT_FOUND', 'Pickup restaurant not found.');
    return {
      ...data,
      pickup: {
        rest_title: pickup.rest_title,
        rest_address: pickup.rest_address,
        longitude: pickup.longitude,
        latitude: pickup.latitude,
      },
    };
  }
  private state(o: Order) {
    return {
      order_id: o.order_id,
      status: o.status,
      company_id: o.company_id,
      driver_id: o.driver_id,
      updated_at: o.updated_at,
    };
  }
  private async change(
    actor: AuthActor,
    id: string,
    work: (o: Order, m: EntityManager) => Promise<void>,
  ) {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.db.transaction('SERIALIZABLE', async (m) => {
          const scope = await this.scope(actor, m, true);
          const order = await this.scopedQuery(scope, m)
            .andWhere('o.order_id = :id', { id })
            .setLock('pessimistic_write')
            .getOne();
          if (!order) throw new ApiError(404, 'NOT_FOUND', 'Order not found.');
          const before = [order.status, order.company_id, order.driver_id].join(
            ':',
          );
          await work(order, m);
          return {
            order,
            state: this.state(order),
            changed:
              before !==
              [order.status, order.company_id, order.driver_id].join(':'),
          };
        });
        if (result.changed) void this.announce(result.order, 'order.updated');
        return result.state;
      } catch (error) {
        const code = (error as { driverError?: { code?: string } }).driverError
          ?.code;
        if (!['40001', '40P01'].includes(code ?? '')) throw error;
        if (attempt >= 2)
          throw new ApiError(
            409,
            'ORDER_CONFLICT',
            'The order changed. Refresh it and try again.',
          );
      }
    }
  }
  private requireState(order: Order, allowed: string[]) {
    if (!allowed.includes(order.status))
      throw new ApiError(
        409,
        'CONFLICT',
        'This action is not allowed for the current order status.',
      );
  }
  async restaurantDecision(actor: AuthActor, id: string, accept: boolean) {
    this.assertRole(actor, 'Restaurant');
    return this.change(actor, id, async (order, m) => {
      if (accept && order.status === 'Accepted') return;
      this.requireState(order, ['Pending']);
      if (accept) {
        order.company_id = await this.delivery.defaultCompany(m);
        order.status = 'Accepted';
      } else order.status = 'Rejected';
      await m.getRepository(Order).save(order);
    });
  }
  async fail(actor: AuthActor, id: string) {
    this.assertRole(actor, 'Admin');
    return this.change(actor, id, async (order, m) => {
      this.requireState(order, ['Accepted', 'Picked_Up']);
      order.status = 'Failed';
      await m.getRepository(Order).save(order);
    });
  }
  async assignDriver(actor: AuthActor, id: string, driverId: string) {
    this.assertRole(actor, 'Delivery_Company');
    return this.change(actor, id, async (order, m) => {
      this.requireState(order, ['Accepted', 'Picked_Up']);
      order.driver_id = await this.delivery.driverForOrder(
        order.company_id!,
        driverId,
        m,
      );
      order.status = 'Picked_Up';
      await m.getRepository(Order).save(order);
    });
  }
  async deliveryAction(actor: AuthActor, id: string, pickup: boolean) {
    this.assertRole(actor, 'Delivery_Company');
    return this.change(actor, id, async (order, m) => {
      if (pickup) {
        // Idempotent: driver assignment already transitions to Picked_Up.
        // Accept Picked_Up as well so explicit pickup calls remain valid.
        this.requireState(order, ['Accepted', 'Picked_Up']);
      } else {
        this.requireState(order, ['Picked_Up']);
      }
      if (!order.driver_id)
        throw new ApiError(
          409,
          'DRIVER_REQUIRED',
          'Assign an active driver before pickup.',
        );
      await this.delivery.driverForOrder(order.company_id!, order.driver_id, m);
      if (pickup && order.status === 'Picked_Up') return; // already transitioned
      order.status = pickup ? 'Picked_Up' : 'Delivered';
      await m.getRepository(Order).save(order);
    });
  }
  async cancel(userId: string, id: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await this.db.transaction('SERIALIZABLE', async (m) => {
          const account = await this.users.byId(userId, m, true);
          if (
            !account ||
            account.role !== 'Customer' ||
            !account.is_active ||
            !account.email_verified_at
          )
            throw new ApiError(
              403,
              'FORBIDDEN',
              'An active verified customer account is required.',
            );
          const repo = m.getRepository(Order);
          const order = await repo
            .createQueryBuilder('o')
            .where('o.customer_id = :userId AND o.order_id = :id', {
              userId,
              id,
            })
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
          return { order: saved, state: this.state(saved) };
        });
        void this.announce(result.order, 'order.updated');
        return result.state;
      } catch (error) {
        const code = (error as { driverError?: { code?: string } }).driverError
          ?.code;
        if (!['40001', '40P01'].includes(code ?? '')) throw error;
        if (attempt >= 2)
          throw new ApiError(
            409,
            'ORDER_CONFLICT',
            'The order changed. Refresh it and try again.',
          );
      }
    }
  }
}
