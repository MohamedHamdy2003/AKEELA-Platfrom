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
import { FixedWindowRateLimiter } from '../../common/http/fixed-window-rate-limiter';
import { Order } from './entities/order.entity';

const HANDSHAKE_WINDOW_MS = 60 * 1000;
const HANDSHAKE_LIMIT_PER_IP = 60;
const HANDSHAKE_MAX_IPS = 10_000;
const SESSION_RECHECK_INTERVAL_MS = 30 * 1000;

type Connection = {
  token: string;
  actor: AuthActor;
  expiresAt: number;
  restId?: string;
  companyId?: string;
};

interface BatchedSessionRow {
  session_id: string;
  user_id: string;
  role: AuthActor['role'];
  rest_id: string | null;
  rest_activation_status: string | null;
  company_id: string | null;
  company_is_active: boolean | null;
}

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
  private sweepTimer?: NodeJS.Timeout;
  private readonly expiryTimers = new Map<string, NodeJS.Timeout>();
  private readonly pendingByUser = new Map<string, number>();
  private readonly connectedByUser = new Map<string, number>();
  private readonly handshakeLimiter = new FixedWindowRateLimiter(
    HANDSHAKE_MAX_IPS,
  );

  constructor(
    private readonly auth: AuthService,
    private readonly restaurants: RestaurantsService,
    private readonly delivery: DeliveryService,
    private readonly db: DataSource,
    private readonly config: ConfigService<Environment, true>,
  ) {}

  private resolveClientIp(socket: Socket): string {
    if (this.config.get('TRUST_PROXY', { infer: true })) {
      const xff = socket.handshake.headers['x-forwarded-for'];
      const raw = Array.isArray(xff) ? xff[xff.length - 1] : xff;
      if (typeof raw === 'string' && raw.trim()) {
        // Match Express `trust proxy = 1`: trust the rightmost hop added by Caddy.
        const hops = raw
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean);
        const clientHop = hops[hops.length - 1];
        if (clientHop) return clientHop;
      }
    }
    return socket.handshake.address || 'unknown';
  }

  private checkHandshakeRate(ip: string): boolean {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return true;
    return this.handshakeLimiter.consume(
      ip,
      HANDSHAKE_LIMIT_PER_IP,
      HANDSHAKE_WINDOW_MS,
    ).allowed;
  }

  private releasePending(socket: Socket): void {
    const timer = socket.data.pendingTimer as NodeJS.Timeout | undefined;
    if (timer) {
      clearTimeout(timer);
      delete socket.data.pendingTimer;
    }
    const userId = socket.data.pendingUserId as string | undefined;
    if (!userId) return;
    delete socket.data.pendingUserId;
    const current = this.pendingByUser.get(userId) ?? 0;
    if (current <= 1) this.pendingByUser.delete(userId);
    else this.pendingByUser.set(userId, current - 1);
  }

  private incrementConnected(userId: string): void {
    this.connectedByUser.set(
      userId,
      (this.connectedByUser.get(userId) ?? 0) + 1,
    );
  }

  private decrementConnected(userId: string): void {
    const current = this.connectedByUser.get(userId) ?? 0;
    if (current <= 1) this.connectedByUser.delete(userId);
    else this.connectedByUser.set(userId, current - 1);
  }

  /**
   * Batch-validate a set of active sessions and their role scopes in a single SQL query.
   * Returns a map of `sessionId -> refreshed Connection scope` for every still-valid session.
   * Throws only on transient DB errors (callers keep existing sockets alive on transient errors).
   */
  private async validateSessionsBatch(connections: Connection[]): Promise<
    Map<
      string,
      {
        restId?: string;
        companyId?: string;
        role: AuthActor['role'];
        userId: string;
      }
    >
  > {
    const now = Date.now();
    const sessionIds = [
      ...new Set(
        connections
          .filter((conn) => conn.expiresAt > now)
          .map((conn) => conn.actor.sessionId),
      ),
    ];
    const valid = new Map<
      string,
      {
        restId?: string;
        companyId?: string;
        role: AuthActor['role'];
        userId: string;
      }
    >();
    if (!sessionIds.length) return valid;

    const rows = (await this.db.query(
      `SELECT
        s.session_id::text AS session_id,
        u.user_id::text AS user_id,
        u.role AS role,
        r.rest_id::text AS rest_id,
        r.activation_status AS rest_activation_status,
        dc.company_id::text AS company_id,
        dc.is_active AS company_is_active
      FROM auth_sessions s
      INNER JOIN users u
        ON u.user_id = s.user_id
       AND u.is_active = true
       AND u.email_verified_at IS NOT NULL
      LEFT JOIN restaurant_profiles r
        ON u.role = 'Restaurant' AND r.user_id = u.user_id
      LEFT JOIN delivery_company_profiles dc
        ON u.role = 'Delivery_Company' AND dc.user_id = u.user_id
      WHERE s.session_id = ANY($1::uuid[])
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()`,
      [sessionIds],
    )) as BatchedSessionRow[];

    for (const row of rows) {
      if (row.role === 'Restaurant') {
        if (!row.rest_id || row.rest_activation_status !== 'Active') continue;
        valid.set(row.session_id, {
          userId: row.user_id,
          role: row.role,
          restId: row.rest_id,
        });
      } else if (row.role === 'Delivery_Company') {
        if (!row.company_id || !row.company_is_active) continue;
        valid.set(row.session_id, {
          userId: row.user_id,
          role: row.role,
          companyId: row.company_id,
        });
      } else {
        valid.set(row.session_id, {
          userId: row.user_id,
          role: row.role,
        });
      }
    }
    return valid;
  }

  private async sweepActiveSessions(): Promise<void> {
    const namespace = this.namespace;
    if (!namespace || namespace.sockets.size === 0) return;
    const sockets = [...namespace.sockets.values()];
    const activeConns: Connection[] = [];
    for (const socket of sockets) {
      const conn = socket.data.connection as Connection | undefined;
      if (conn) activeConns.push(conn);
    }
    if (!activeConns.length) return;
    let validBySession: Awaited<ReturnType<typeof this.validateSessionsBatch>>;
    try {
      validBySession = await this.validateSessionsBatch(activeConns);
    } catch {
      // Transient DB error: preserve active sockets until next sweep or notify check.
      return;
    }
    const now = Date.now();
    for (const socket of sockets) {
      if (!socket.connected) continue;
      const conn = socket.data.connection as Connection | undefined;
      if (!conn) continue;
      const fresh =
        conn.expiresAt > now
          ? validBySession.get(conn.actor.sessionId)
          : undefined;
      if (
        !fresh ||
        fresh.userId !== conn.actor.userId ||
        fresh.role !== conn.actor.role
      ) {
        socket.disconnect(true);
      } else {
        conn.restId = fresh.restId;
        conn.companyId = fresh.companyId;
      }
    }
  }

  afterInit(namespace: Namespace) {
    this.namespace = namespace;
    if (!this.sweepTimer) {
      this.sweepTimer = setInterval(() => {
        void this.sweepActiveSessions();
      }, SESSION_RECHECK_INTERVAL_MS);
      this.sweepTimer.unref();
    }
    namespace.use((socket, next) => {
      const origin = socket.handshake.headers.origin;
      if (
        origin &&
        !this.config.get('CORS_ORIGINS', { infer: true }).includes(origin)
      )
        return next(new Error('ORIGIN_NOT_ALLOWED'));
      const ip = this.resolveClientIp(socket);
      if (!this.checkHandshakeRate(ip)) return next(new Error('RATE_LIMITED'));
      const token: unknown = socket.handshake.auth?.token;
      if (typeof token !== 'string' || token.length > 8192)
        return next(new Error('UNAUTHENTICATED'));
      void this.context(token)
        .then((context) => {
          const userId = context.actor.userId;
          const count = this.connectedByUser.get(userId) ?? 0;
          const pending = this.pendingByUser.get(userId) ?? 0;
          if (count + pending >= 10) return next(new Error('CONNECTION_LIMIT'));
          this.pendingByUser.set(userId, pending + 1);
          socket.data.pendingUserId = userId;
          socket.data.connection = context;
          const pendingTimer = setTimeout(
            () => this.releasePending(socket),
            10_000,
          );
          pendingTimer.unref();
          socket.data.pendingTimer = pendingTimer;
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
    this.releasePending(socket);
    if (!socket.connected) return;
    const context = socket.data.connection as Connection;
    this.incrementConnected(context.actor.userId);
    socket.data.connectedUserId = context.actor.userId;
    if (context.actor.role === 'Admin') void socket.join('admin');
    else if (context.actor.role === 'Customer')
      void socket.join(`customer:${context.actor.userId}`);
    else if (context.actor.role === 'Restaurant' && context.restId)
      void socket.join(`rest:${context.restId}`);
    else if (context.actor.role === 'Delivery_Company' && context.companyId)
      void socket.join(`company:${context.companyId}`);
    const expiry = setTimeout(
      () => socket.disconnect(true),
      Math.max(0, Math.min(context.expiresAt - Date.now(), 2147483647)),
    );
    expiry.unref();
    this.expiryTimers.set(socket.id, expiry);
  }

  handleDisconnect(socket: Socket) {
    this.releasePending(socket);
    const connectedUserId = socket.data.connectedUserId as string | undefined;
    if (connectedUserId) {
      this.decrementConnected(connectedUserId);
      delete socket.data.connectedUserId;
    }
    const expiry = this.expiryTimers.get(socket.id);
    if (expiry) {
      clearTimeout(expiry);
      this.expiryTimers.delete(socket.id);
    }
    delete socket.data.connection;
  }

  onModuleDestroy() {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = undefined;
    }
    for (const expiry of this.expiryTimers.values()) {
      clearTimeout(expiry);
    }
    this.expiryTimers.clear();
    this.pendingByUser.clear();
    this.connectedByUser.clear();
    this.handshakeLimiter.clear();
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
    const namespace = this.namespace;
    if (!namespace) return;
    const payload = {
      order_id: order.order_id,
      status: order.status,
      company_id: order.company_id,
      driver_id: order.driver_id,
      updated_at: cairoTimestamp(order.updated_at),
    };
    const rooms = [
      'admin',
      `customer:${order.customer_id}`,
      `rest:${order.rest_id}`,
      ...(order.company_id ? [`company:${order.company_id}`] : []),
    ];
    const targetIds = new Set<string>();
    const adapterRooms = namespace.adapter.rooms;
    for (const room of rooms) {
      const members = adapterRooms.get(room);
      if (members) for (const id of members) targetIds.add(id);
    }
    if (!targetIds.size) return;

    const candidates: Array<{ socket: Socket; bound: Connection }> = [];
    for (const socketId of targetIds) {
      const socket = namespace.sockets.get(socketId);
      if (!socket || !socket.connected) continue;
      const bound = socket.data.connection as Connection | undefined;
      if (!bound || !this.canRead(bound, order)) continue;
      candidates.push({ socket, bound });
    }
    if (!candidates.length) return;

    let validBySession: Awaited<ReturnType<typeof this.validateSessionsBatch>>;
    try {
      validBySession = await this.validateSessionsBatch(
        candidates.map((c) => c.bound),
      );
    } catch {
      this.reportFailure();
      return;
    }

    const now = Date.now();
    for (const { socket, bound } of candidates) {
      const fresh =
        bound.expiresAt > now
          ? validBySession.get(bound.actor.sessionId)
          : undefined;
      if (
        !fresh ||
        fresh.userId !== bound.actor.userId ||
        fresh.role !== bound.actor.role
      ) {
        socket.disconnect(true);
        continue;
      }
      bound.restId = fresh.restId;
      bound.companyId = fresh.companyId;
      if (socket.connected && this.canRead(bound, order)) {
        socket.emit(event, payload);
      }
    }
  }

  reportFailure() {
    Logger.warn(
      'Realtime order notification failed; clients must resynchronize through REST.',
      'Orders',
    );
  }
}
