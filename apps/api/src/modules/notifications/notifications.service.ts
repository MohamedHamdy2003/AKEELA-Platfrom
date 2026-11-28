import { Injectable, Logger } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { ApiError } from '../../common/http/api-error';
import { AuthActor } from '../../common/http/current-actor.decorator';
import { Semaphore } from '../../common/concurrency';
import { UsersService } from '../users/users.service';
import { RestaurantsService } from '../restaurants/restaurants.service';
import { DeliveryService } from '../delivery/delivery.service';
import { Order } from '../orders/entities/order.entity';
import { DeviceToken } from './entities/device-token.entity';
import { FcmClient } from './fcm.client';
import {
  AdminSendNotificationDto,
  RegisterDeviceTokenDto,
} from './notifications.dto';

const MAX_TOKENS_PER_USER = 15;
const SEND_CONCURRENCY = 8;

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface DispatchSummary {
  fcm_configured: boolean;
  targeted_users: number;
  targeted_tokens: number;
  sent: number;
  failed: number;
  pruned_tokens: number;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly semaphore = new Semaphore(SEND_CONCURRENCY);

  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly restaurants: RestaurantsService,
    private readonly delivery: DeliveryService,
    private readonly fcm: FcmClient,
  ) {}

  private serializeToken(row: DeviceToken) {
    return {
      token_id: row.token_id,
      platform: row.platform,
      device_label: row.device_label,
      token_preview:
        row.fcm_token.length > 16
          ? `${row.fcm_token.slice(0, 8)}...${row.fcm_token.slice(-6)}`
          : row.fcm_token,
      last_seen_at: row.last_seen_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private async assertActiveActor(actor: AuthActor) {
    const account = await this.users.byId(actor.userId);
    if (
      !account ||
      account.role !== actor.role ||
      !account.is_active ||
      !account.email_verified_at
    ) {
      throw new ApiError(
        403,
        'FORBIDDEN',
        'An active verified account is required.',
      );
    }
    return account;
  }

  async listOwnTokens(actor: AuthActor) {
    await this.assertActiveActor(actor);
    const rows = await this.db
      .getRepository(DeviceToken)
      .createQueryBuilder('dt')
      .leftJoin('auth_sessions', 's', 's.session_id = dt.session_id')
      .where('dt.user_id = :userId', { userId: actor.userId })
      .andWhere(
        '(dt.session_id IS NULL OR (s.revoked_at IS NULL AND s.expires_at > NOW()))',
      )
      .orderBy('dt.last_seen_at', 'DESC')
      .addOrderBy('dt.token_id', 'DESC')
      .getMany();
    return rows.map((row) => this.serializeToken(row));
  }

  async registerToken(actor: AuthActor, input: RegisterDeviceTokenDto) {
    await this.assertActiveActor(actor);
    const saved = await this.db.transaction(async (manager) => {
      const repo = manager.getRepository(DeviceToken);
      const now = new Date();
      const hasLabel = input.device_label !== undefined;
      const normalizedLabel = hasLabel ? input.device_label || null : null;
      const [row] = (await manager.query(
        `INSERT INTO device_tokens (user_id, session_id, fcm_token, platform, device_label, last_seen_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (fcm_token) DO UPDATE SET
           user_id = EXCLUDED.user_id,
           session_id = EXCLUDED.session_id,
           platform = EXCLUDED.platform,
           device_label = CASE WHEN $7::boolean THEN EXCLUDED.device_label ELSE device_tokens.device_label END,
           last_seen_at = EXCLUDED.last_seen_at,
           updated_at = NOW()
         RETURNING *`,
        [
          actor.userId,
          actor.sessionId,
          input.fcm_token,
          input.platform,
          normalizedLabel,
          now,
          hasLabel,
        ],
      )) as DeviceToken[];

      // Enforce per-user device token cap by pruning oldest excess tokens.
      const userTokens = await repo.find({
        select: { token_id: true },
        where: { user_id: actor.userId },
        order: { last_seen_at: 'DESC', token_id: 'DESC' },
      });
      if (userTokens.length > MAX_TOKENS_PER_USER) {
        const excessIds = userTokens
          .slice(MAX_TOKENS_PER_USER)
          .map((t) => t.token_id);
        await repo.delete({ token_id: In(excessIds) });
      }
      return row!;
    });
    return this.serializeToken(saved);
  }

  async unregisterToken(actor: AuthActor, tokenId: string): Promise<void> {
    await this.assertActiveActor(actor);
    if (!/^[1-9]\d{0,18}$/.test(tokenId)) {
      throw new ApiError(404, 'NOT_FOUND', 'Device token not found.');
    }
    const result = await this.db
      .getRepository(DeviceToken)
      .delete({ token_id: tokenId, user_id: actor.userId });
    if (!result.affected) {
      throw new ApiError(404, 'NOT_FOUND', 'Device token not found.');
    }
  }

  private async pruneDeadTokens(deadTokenIds: string[]): Promise<void> {
    const repo = this.db.getRepository(DeviceToken);
    for (let i = 0; i < deadTokenIds.length; i += 500) {
      await repo
        .delete({ token_id: In(deadTokenIds.slice(i, i + 500)) })
        .catch(() => undefined);
    }
  }

  private async dispatchTokens(
    tokens: DeviceToken[],
    targetedUsers: number,
    payload: PushPayload,
  ): Promise<DispatchSummary> {
    if (!tokens.length || !this.fcm.isConfigured) {
      return {
        fcm_configured: this.fcm.isConfigured,
        targeted_users: targetedUsers,
        targeted_tokens: tokens.length,
        sent: 0,
        failed: 0,
        pruned_tokens: 0,
      };
    }

    let sent = 0;
    let failed = 0;
    const deadTokenIds: string[] = [];

    await Promise.all(
      tokens.map((row) =>
        this.semaphore.run(async () => {
          const result = await this.fcm.send({
            token: row.fcm_token,
            title: payload.title,
            body: payload.body,
            data: payload.data,
          });
          if (result.ok) {
            sent += 1;
          } else {
            failed += 1;
            if (result.unregister) {
              deadTokenIds.push(row.token_id);
            }
          }
        }),
      ),
    );

    if (deadTokenIds.length) {
      await this.pruneDeadTokens(deadTokenIds);
    }

    return {
      fcm_configured: true,
      targeted_users: targetedUsers,
      targeted_tokens: tokens.length,
      sent,
      failed,
      pruned_tokens: deadTokenIds.length,
    };
  }

  async sendToUsers(
    userIds: string[],
    payload: PushPayload,
  ): Promise<DispatchSummary> {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (!uniqueUserIds.length) {
      return {
        fcm_configured: this.fcm.isConfigured,
        targeted_users: 0,
        targeted_tokens: 0,
        sent: 0,
        failed: 0,
        pruned_tokens: 0,
      };
    }

    const tokens: DeviceToken[] = [];
    for (let i = 0; i < uniqueUserIds.length; i += 5000) {
      const batch = await this.db
        .getRepository(DeviceToken)
        .createQueryBuilder('dt')
        .innerJoin(
          'users',
          'u',
          'u.user_id = dt.user_id AND u.is_active = true AND u.email_verified_at IS NOT NULL',
        )
        .leftJoin('auth_sessions', 's', 's.session_id = dt.session_id')
        .where('dt.user_id IN (:...userIds)', {
          userIds: uniqueUserIds.slice(i, i + 5000),
        })
        .andWhere(
          '(dt.session_id IS NULL OR (s.revoked_at IS NULL AND s.expires_at > NOW()))',
        )
        .getMany();
      tokens.push(...batch);
    }

    return this.dispatchTokens(tokens, uniqueUserIds.length, payload);
  }

  private async sendToRole(
    role: 'Customer' | 'Restaurant' | 'Delivery_Company' | 'Admin',
    payload: PushPayload,
  ): Promise<DispatchSummary> {
    const [{ count }] = (await this.db.query(
      `SELECT COUNT(*)::int AS count
       FROM users
       WHERE role = $1 AND is_active = true AND email_verified_at IS NOT NULL`,
      [role],
    )) as [{ count: number }];
    const targetedUsers = Number(count ?? 0);
    if (!targetedUsers) {
      return {
        fcm_configured: this.fcm.isConfigured,
        targeted_users: 0,
        targeted_tokens: 0,
        sent: 0,
        failed: 0,
        pruned_tokens: 0,
      };
    }

    const tokens = await this.db
      .getRepository(DeviceToken)
      .createQueryBuilder('dt')
      .innerJoin(
        'users',
        'u',
        'u.user_id = dt.user_id AND u.role = :role AND u.is_active = true AND u.email_verified_at IS NOT NULL',
        { role },
      )
      .leftJoin('auth_sessions', 's', 's.session_id = dt.session_id')
      .where(
        '(dt.session_id IS NULL OR (s.revoked_at IS NULL AND s.expires_at > NOW()))',
      )
      .getMany();

    return this.dispatchTokens(tokens, targetedUsers, payload);
  }

  async notifyOrderEvent(
    event: 'order.created' | 'order.updated',
    order: Order,
  ): Promise<void> {
    if (!this.fcm.isConfigured) return;
    try {
      const baseData: Record<string, string> = {
        type: event,
        order_id: order.order_id,
        status: order.status,
        rest_id: order.rest_id,
        company_id: order.company_id ?? '',
        driver_id: order.driver_id ?? '',
      };

      const [restaurant, company] = await Promise.all([
        this.restaurants.profileById(order.rest_id),
        order.company_id
          ? this.delivery.profileById(order.company_id)
          : Promise.resolve(null),
      ]);
      const restUserId = restaurant?.user_id ?? null;
      const companyUserId = company?.user_id ?? null;
      const restTitle = restaurant?.rest_title ?? 'المطعم';

      const dispatches: Array<Promise<unknown>> = [];

      if (event === 'order.created') {
        if (restUserId) {
          dispatches.push(
            this.sendToUsers([restUserId], {
              title: `طلب جديد #${order.order_id}`,
              body: `لديك طلب جديد بقيمة ${order.total_price} ج.م بانتظار المراجعة والقبول.`,
              data: baseData,
            }),
          );
        }
        const adminIds = await this.users.activeVerifiedIdsByRole('Admin');
        if (adminIds.length) {
          dispatches.push(
            this.sendToUsers(adminIds, {
              title: `طلب جديد #${order.order_id}`,
              body: `تم إنشاء طلب جديد لدى «${restTitle}» بقيمة ${order.total_price} ج.م.`,
              data: baseData,
            }),
          );
        }
      } else {
        switch (order.status) {
          case 'Accepted':
            dispatches.push(
              this.sendToUsers([order.customer_id], {
                title: `تم قبول طلبك #${order.order_id}`,
                body: `وافق «${restTitle}» على طلبك وجارٍ تحضيره الآن.`,
                data: baseData,
              }),
            );
            if (companyUserId) {
              dispatches.push(
                this.sendToUsers([companyUserId], {
                  title: `طلب جديد للتوصيل #${order.order_id}`,
                  body: `تم إسناد طلب من «${restTitle}» لشركتك وهو جاهز لتعيين سائق.`,
                  data: baseData,
                }),
              );
            }
            break;
          case 'Picked_Up':
            dispatches.push(
              this.sendToUsers([order.customer_id], {
                title: `طلبك في الطريق إليك #${order.order_id}`,
                body: `استلم السائق طلبك من «${restTitle}» وهو في طريقه إليك الآن.`,
                data: baseData,
              }),
            );
            break;
          case 'Delivered':
            dispatches.push(
              this.sendToUsers([order.customer_id], {
                title: `تم توصيل طلبك #${order.order_id}`,
                body: `بالهناء والشفاء! تم تسليم طلبك من «${restTitle}» بنجاح.`,
                data: baseData,
              }),
            );
            if (restUserId) {
              dispatches.push(
                this.sendToUsers([restUserId], {
                  title: `تم تسليم الطلب #${order.order_id}`,
                  body: `تم تسليم الطلب للعميل بنجاح.`,
                  data: baseData,
                }),
              );
            }
            break;
          case 'Rejected':
            dispatches.push(
              this.sendToUsers([order.customer_id], {
                title: `تعذّر قبول طلبك #${order.order_id}`,
                body: `اعتذر «${restTitle}» عن قبول الطلب حالياً.`,
                data: baseData,
              }),
            );
            break;
          case 'Cancelled':
            if (restUserId) {
              dispatches.push(
                this.sendToUsers([restUserId], {
                  title: `تم إلغاء الطلب #${order.order_id}`,
                  body: `قام العميل بإلغاء الطلب قبل بدء التحضير.`,
                  data: baseData,
                }),
              );
            }
            break;
          case 'Failed':
            dispatches.push(
              this.sendToUsers([order.customer_id], {
                title: `تعثّر توصيل الطلب #${order.order_id}`,
                body: `نعتذر، تعذّر إكمال توصيل طلبك. يرجى التواصل مع الدعم.`,
                data: baseData,
              }),
            );
            if (restUserId || companyUserId) {
              dispatches.push(
                this.sendToUsers(
                  [restUserId, companyUserId].filter((id): id is string =>
                    Boolean(id),
                  ),
                  {
                    title: `تعثّر الطلب #${order.order_id}`,
                    body: `تم تسجيل الطلب بحالة متعثر من الإدارة.`,
                    data: baseData,
                  },
                ),
              );
            }
            break;
          default:
            break;
        }
      }

      await Promise.all(dispatches);
    } catch (error) {
      this.logger.warn(
        `Push notification dispatch skipped for order ${order.order_id}: ${String(error)}`,
      );
    }
  }

  async adminSend(
    actor: AuthActor,
    input: AdminSendNotificationDto,
  ): Promise<DispatchSummary> {
    if (actor.role !== 'Admin') {
      throw new ApiError(403, 'FORBIDDEN', 'Admin access required.');
    }
    await this.assertActiveActor(actor);

    const hasUser = Boolean(input.user_id);
    const hasRole = Boolean(input.role);
    if (hasUser === hasRole) {
      throw new ApiError(
        422,
        'VALIDATION_ERROR',
        'Provide either user_id or role (not both).',
      );
    }

    const sanitizedData: Record<string, string> = {};
    if (input.data) {
      const entries = Object.entries(input.data);
      if (entries.length > 20) {
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'data cannot contain more than 20 entries.',
        );
      }
      for (const [k, v] of entries) {
        if (typeof v !== 'string' || k.length > 64 || v.length > 256) {
          throw new ApiError(
            422,
            'VALIDATION_ERROR',
            'Each data entry must have a string key (<= 64 chars) and string value (<= 256 chars).',
          );
        }
        sanitizedData[k] = v;
      }
    }

    const payload: PushPayload = {
      title: input.title,
      body: input.body,
      data: Object.keys(sanitizedData).length ? sanitizedData : undefined,
    };

    if (input.user_id) {
      const target = await this.users.byId(input.user_id);
      if (!target) {
        throw new ApiError(404, 'NOT_FOUND', 'Target user not found.');
      }
      return this.sendToUsers([target.user_id], payload);
    }
    return this.sendToRole(input.role!, payload);
  }
}
