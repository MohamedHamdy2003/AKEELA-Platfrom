import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Namespace, Socket } from 'socket.io';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DeliveryService } from '../delivery/delivery.service';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { Environment } from '../../config/environment';
import { cairoTimestamp } from '../../common/time';
import { Order } from './entities/order.entity';

type Connection = {
  token: string;
  actor: AuthActor;
  expiresAt: number;
  restId?: string;
  companyId?: string;
};
export type OrderEvent = 'order.created' | 'order.updated';
@WebSocketGateway({
  namespace: '/orders',
  transports: ['websocket'],
  maxHttpBufferSize: 1024,
})
@Injectable()
export class OrderEventsGateway
  implements
    OnGatewayInit<Namespace>,
    OnGatewayConnection<Socket>,
    OnGatewayDisconnect<Socket>,
    OnModuleDestroy
{
  private namespace?: Namespace;
  private readonly timers = new Map<
    string,
    { expiry: NodeJS.Timeout; check: NodeJS.Timeout }
  >();
  constructor(
    private readonly auth: AuthService,
    private readonly restaurants: RestaurantsService,
    private readonly delivery: DeliveryService,
    private readonly db: DataSource,
    private readonly config: ConfigService<Environment, true>,
  ) {}
  afterInit(namespace: Namespace) {
    this.namespace = namespace;
    namespace.use((socket, next) => {
      const origin = socket.handshake.headers.origin;
      if (
        origin &&
        !this.config.get('CORS_ORIGINS', { infer: true }).includes(origin)
      )
        return next(new Error('ORIGIN_NOT_ALLOWED'));
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length > 8192)
        return next(new Error('UNAUTHENTICATED'));
      void this.context(token)
        .then((context) => {
          const count = [...namespace.sockets.values()].filter(
            (other) =>
              (other.data.connection as Connection | undefined)?.actor
                .userId === context.actor.userId,
          ).length;
          if (count >= 10) return next(new Error('CONNECTION_LIMIT'));
          socket.data.connection = context;
          next();
        })
        .catch(() => next(new Error('UNAUTHENTICATED')));
    });
  }
  private async context(token: string): Promise<Connection> {
    const authenticated = await this.auth.authenticateAccess(token);
    const actor = authenticated.actor;
    const context: Connection = { token, ...authenticated };
    if (actor.role === 'Restaurant')
      context.restId = await this.restaurants.forOrderHandling(
        actor.userId,
        this.db.manager,
      );
    if (actor.role === 'Delivery_Company') {
      const company = await this.delivery.ownedProfile(actor.userId);
      if (!company.is_active) throw new Error('INACTIVE');
      context.companyId = company.company_id;
    }
    return context;
  }
  handleConnection(socket: Socket) {
    const context = socket.data.connection as Connection;
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, Math.min(context.expiresAt - Date.now(), 2147483647)),
    );
    const check = setInterval(() => {
      void this.context(context.token)
        .then((fresh) => {
          if (socket.connected) socket.data.connection = fresh;
        })
        .catch(() => socket.disconnect(true));
    }, 30000);
    expiry.unref();
    check.unref();
    this.timers.set(socket.id, { expiry, check });
  }
  handleDisconnect(socket: Socket) {
    const timers = this.timers.get(socket.id);
    if (timers) {
      clearTimeout(timers.expiry);
      clearInterval(timers.check);
      this.timers.delete(socket.id);
    }
    delete socket.data.connection;
  }
  onModuleDestroy() {
    for (const timers of this.timers.values()) {
      clearTimeout(timers.expiry);
      clearInterval(timers.check);
    }
    this.timers.clear();
  }
  private canRead(context: Connection, order: Order) {
    return (
      context.actor.role === 'Admin' ||
      (context.actor.role === 'Customer' &&
        context.actor.userId === order.customer_id) ||
      (context.actor.role === 'Restaurant' &&
        context.restId === order.rest_id) ||
      (context.actor.role === 'Delivery_Company' &&
        context.companyId === order.company_id)
    );
  }
  async notify(event: OrderEvent, order: Order): Promise<void> {
    const payload = {
      order_id: order.order_id,
      status: order.status,
      company_id: order.company_id,
      driver_id: order.driver_id,
      updated_at: cairoTimestamp(order.updated_at),
    };
    await Promise.allSettled(
      [...(this.namespace?.sockets.values() ?? [])].map(async (socket) => {
        const bound = socket.data.connection as Connection | undefined;
        if (!bound || !this.canRead(bound, order)) return;
        try {
          const fresh = await this.context(bound.token);
          if (socket.connected && this.canRead(fresh, order))
            socket.emit(event, payload);
        } catch {
          socket.disconnect(true);
        }
      }),
    );
  }
  reportFailure() {
    Logger.warn(
      'Realtime order notification failed; clients must resynchronize through REST.',
      'Orders',
    );
  }
}
