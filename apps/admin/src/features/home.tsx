import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Receipt,
  ShieldAlert,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  Truck,
  Users,
} from 'lucide-react';
import type { AdminAnalytics, AnalyticsRange } from '@akeela/portal/models';
import { Failure, PageTitle, money, useResource } from '@akeela/portal/ui';
import { api } from '../lib/api';
import { navigation } from '../lib/navigation';
import {
  PeakHoursChart,
  StatusDonutChart,
  TrendChart,
} from './analytics-charts';
import './home.css';

const RANGE_OPTIONS: Array<{ key: AnalyticsRange; label: string }> = [
  { key: 'today', label: 'اليوم' },
  { key: '7d', label: '7 أيام' },
  { key: '30d', label: '30 يوماً' },
  { key: '90d', label: '90 يوماً' },
  { key: 'all', label: 'الكل' },
];

function DeltaBadge({
  current,
  previous,
}: {
  current: number;
  previous: number | null;
}) {
  if (previous === null) return null;
  if (previous === 0) {
    if (current === 0) {
      return <span className="adm-delta is-flat numeric">0%</span>;
    }
    return <span className="adm-delta is-up">جديد</span>;
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (pct === 0) {
    return <span className="adm-delta is-flat numeric">0%</span>;
  }
  const up = pct > 0;
  return (
    <span className={'adm-delta numeric ' + (up ? 'is-up' : 'is-down')}>
      {up ? (
        <TrendingUp size={12} aria-hidden="true" />
      ) : (
        <TrendingDown size={12} aria-hidden="true" />
      )}
      <bdi>{`${up ? '+' : ''}${pct}%`}</bdi>
    </span>
  );
}

function AnalyticsSkeleton() {
  return (
    <div
      className="adm-home"
      aria-label="جارٍ تحميل التحليلات"
      aria-busy="true"
      role="status"
    >
      <div className="adm-sk-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="adm-sk-card" />
        ))}
      </div>
      <div className="adm-grid-primary">
        <div className="adm-sk-chart" />
        <div className="adm-sk-chart" />
      </div>
    </div>
  );
}

export function Home({
  revision,
  navigate,
}: {
  revision: number;
  navigate: (key: string, filter?: string) => void;
}) {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [restTab, setRestTab] = useState<'top' | 'attention'>('top');
  const analytics = useResource<AdminAnalytics>(
    api,
    `/admin/analytics?range=${range}`,
    revision,
  );
  const [cached, setCached] = useState<AdminAnalytics | null>(null);

  useEffect(() => {
    if (analytics.result?.data) {
      setCached(analytics.result.data);
    }
  }, [analytics.result]);

  const sameRangeCached = cached?.range === range ? cached : null;
  const data =
    analytics.result?.data ?? (analytics.error ? sameRangeCached : cached);
  const kpis = data?.kpis;
  const prev = data?.previous_kpis ?? null;
  const alerts = data?.alerts;
  const totals = data?.platform_totals;
  const hasAlerts =
    alerts &&
    alerts.stale_pending_orders +
      alerts.stale_accepted_orders +
      alerts.pending_restaurants +
      alerts.unverified_companies >
      0;

  const activeRestaurantsList =
    restTab === 'top'
      ? (data?.top_restaurants ?? [])
      : (data?.attention_restaurants ?? []);
  const maxItemRevenue = Math.max(
    1,
    ...(data?.top_items ?? []).map((item) => Number(item.revenue) || 0),
  );

  return (
    <div
      className="adm-home"
      data-refreshing={analytics.loading && Boolean(data)}
    >
      <div className="adm-home-head">
        <PageTitle
          title="نظرة عامة"
          description="مركز التحليلات والقرارات التشغيلية للمنصة بتوقيت القاهرة."
        />
        <div className="adm-home-controls">
          <div
            className="adm-seg"
            role="group"
            aria-label="الفترة الزمنية للتحليلات"
          >
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={range === option.key ? 'active' : ''}
                aria-pressed={range === option.key}
                onClick={() => setRange(option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {Boolean(analytics.error) && (
        <Failure error={analytics.error} retry={analytics.reload} />
      )}

      {!data && analytics.loading && <AnalyticsSkeleton />}

      {data && kpis && alerts && totals && (
        <>
          <section className="adm-alerts" aria-label="تنبيهات التشغيل الحية">
            {hasAlerts ? (
              <>
                {alerts.stale_pending_orders > 0 && (
                  <button
                    type="button"
                    className="adm-alert-pill is-danger"
                    onClick={() => navigate('orders', 'Pending')}
                  >
                    <AlertTriangle size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.stale_pending_orders} طلب معلّق لأكثر من 15 دقيقة
                    </span>
                  </button>
                )}
                {alerts.stale_accepted_orders > 0 && (
                  <button
                    type="button"
                    className="adm-alert-pill is-warning"
                    onClick={() => navigate('orders', 'Accepted')}
                  >
                    <Clock size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.stale_accepted_orders} طلب مقبول بدون سائق (+20 د)
                    </span>
                  </button>
                )}
                {alerts.pending_restaurants > 0 && (
                  <button
                    type="button"
                    className="adm-alert-pill is-warning"
                    onClick={() => navigate('restaurants', 'Pending')}
                  >
                    <Store size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.pending_restaurants} مطعم بانتظار التفعيل
                    </span>
                  </button>
                )}
                {alerts.unverified_companies > 0 && (
                  <button
                    type="button"
                    className="adm-alert-pill is-info"
                    onClick={() => navigate('companies')}
                  >
                    <ShieldAlert size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.unverified_companies} شركة توصيل غير موثّقة
                    </span>
                  </button>
                )}
              </>
            ) : (
              <div className="adm-alert-pill is-ok" role="status">
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>
                  التشغيل مستقر — لا توجد تنبيهات عاجلة تتطلب تدخلاً حالياً.
                </span>
              </div>
            )}
          </section>

          <section className="adm-kpi-grid" aria-label="المؤشرات التنفيذية">
            <article className="adm-kpi">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">
                  <span className="adm-kpi-ico is-emerald" aria-hidden="true">
                    <Banknote size={17} />
                  </span>
                  إجمالي المبيعات (GMV)
                </span>
                <DeltaBadge
                  current={Number(kpis.delivered_gmv)}
                  previous={prev ? Number(prev.delivered_gmv) : null}
                />
              </div>
              <div className="adm-kpi-val numeric">
                <bdi>{money(kpis.delivered_gmv)}</bdi>
              </div>
              <div className="adm-kpi-foot">
                <span className="numeric">
                  من {kpis.delivered_orders} طلب مُسلّم بنجاح
                </span>
              </div>
            </article>

            <article className="adm-kpi">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">
                  <span className="adm-kpi-ico is-teal" aria-hidden="true">
                    <Truck size={17} />
                  </span>
                  إجمالي رسوم التوصيل
                </span>
                <DeltaBadge
                  current={Number(kpis.delivery_fees_total)}
                  previous={prev ? Number(prev.delivery_fees_total) : null}
                />
              </div>
              <div className="adm-kpi-val numeric">
                <bdi>{money(kpis.delivery_fees_total)}</bdi>
              </div>
              <div className="adm-kpi-foot">
                <span>رسوم الطلبات المُسلّمة خلال الفترة</span>
              </div>
            </article>

            <article className="adm-kpi">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">
                  <span className="adm-kpi-ico is-gold" aria-hidden="true">
                    <Receipt size={17} />
                  </span>
                  متوسط قيمة الطلب (AOV)
                </span>
                <DeltaBadge
                  current={Number(kpis.avg_order_value)}
                  previous={prev ? Number(prev.avg_order_value) : null}
                />
              </div>
              <div className="adm-kpi-val numeric">
                <bdi>{money(kpis.avg_order_value)}</bdi>
              </div>
              <div className="adm-kpi-foot">
                <span>متوسط السلة للطلبات الناجحة</span>
              </div>
            </article>

            <button
              type="button"
              className="adm-kpi"
              onClick={() => navigate('orders')}
            >
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">
                  <span className="adm-kpi-ico is-dark" aria-hidden="true">
                    <ShoppingBag size={17} />
                  </span>
                  إجمالي الطلبات
                </span>
                <DeltaBadge
                  current={kpis.total_orders}
                  previous={prev ? prev.total_orders : null}
                />
              </div>
              <div className="adm-kpi-val numeric">{kpis.total_orders}</div>
              <div className="adm-kpi-foot">
                <span className="numeric">
                  {kpis.delivered_orders} مُسلّم · اضغط للمتابعة ←
                </span>
              </div>
            </button>

            <article className="adm-kpi">
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">
                  <span className="adm-kpi-ico is-emerald" aria-hidden="true">
                    <CheckCircle2 size={17} />
                  </span>
                  معدل الإتمام وجودة التشغيل
                </span>
              </div>
              <div className="adm-kpi-val numeric">
                <bdi>{kpis.completion_rate}%</bdi>
              </div>
              <div className="adm-quality-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${kpis.completion_rate}%`,
                    background: '#146c36',
                  }}
                />
                <span
                  style={{
                    width: `${kpis.rejection_rate}%`,
                    background: '#e11d48',
                  }}
                />
                <span
                  style={{
                    width: `${kpis.cancellation_rate}%`,
                    background: '#64748b',
                  }}
                />
                <span
                  style={{
                    width: `${kpis.failure_rate}%`,
                    background: '#b91c1c',
                  }}
                />
              </div>
              <div className="adm-kpi-foot numeric">
                <span>
                  رفض {kpis.rejection_rate}% · إلغاء {kpis.cancellation_rate}% ·
                  تعثر {kpis.failure_rate}%
                </span>
              </div>
            </article>

            <button
              type="button"
              className="adm-kpi"
              onClick={() => navigate('users')}
            >
              <div className="adm-kpi-top">
                <span className="adm-kpi-label">
                  <span className="adm-kpi-ico is-blue" aria-hidden="true">
                    <Users size={17} />
                  </span>
                  نمو المنصة (عملاء جدد)
                </span>
                <DeltaBadge
                  current={kpis.new_customers}
                  previous={prev ? prev.new_customers : null}
                />
              </div>
              <div className="adm-kpi-val numeric">{kpis.new_customers}</div>
              <div className="adm-kpi-foot numeric">
                <span>+{kpis.new_restaurants} مطعم جديد خلال الفترة ←</span>
              </div>
            </button>
          </section>

          <div className="adm-grid-primary">
            <TrendChart series={data.daily_series} />
            <StatusDonutChart
              counts={data.status_breakdown}
              onSelectOrders={(status) => navigate('orders', status)}
            />
          </div>

          <div className="adm-grid-secondary">
            <PeakHoursChart hours={data.peak_hours} />
            <section className="panel adm-card">
              <div className="adm-card-head">
                <div>
                  <h2>ملخص أصول المنصة</h2>
                  <p className="adm-card-sub">
                    الحالة الحالية للشركاء والحسابات والأسطول
                  </p>
                </div>
              </div>
              <div className="adm-assets-list">
                <button
                  type="button"
                  className="adm-asset-row"
                  onClick={() => navigate('restaurants')}
                >
                  <span className="adm-asset-title">
                    <Store size={16} aria-hidden="true" />
                    المطاعم ({totals.restaurants_total})
                  </span>
                  <span className="adm-asset-pills numeric">
                    <span className="adm-mini-pill is-green">
                      {totals.restaurants_active} مفعّل
                    </span>
                    <span className="adm-mini-pill is-amber">
                      {totals.restaurants_pending} منتظر
                    </span>
                    {totals.restaurants_suspended > 0 && (
                      <span className="adm-mini-pill is-rose">
                        {totals.restaurants_suspended} معلّق
                      </span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  className="adm-asset-row"
                  onClick={() => navigate('users')}
                >
                  <span className="adm-asset-title">
                    <Users size={16} aria-hidden="true" />
                    الحسابات ({totals.total_users})
                  </span>
                  <span className="adm-asset-pills numeric">
                    <span className="adm-mini-pill">
                      {totals.customers} عميل مسجّل
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="adm-asset-row"
                  onClick={() => navigate('companies')}
                >
                  <span className="adm-asset-title">
                    <Truck size={16} aria-hidden="true" />
                    شركات التوصيل والأسطول
                  </span>
                  <span className="adm-asset-pills numeric">
                    <span className="adm-mini-pill">
                      {totals.delivery_companies} شركة
                    </span>
                    <span className="adm-mini-pill is-green">
                      {totals.active_drivers} سائق نشط
                    </span>
                    {totals.inactive_drivers > 0 && (
                      <span className="adm-mini-pill">
                        {totals.inactive_drivers} متوقف
                      </span>
                    )}
                  </span>
                </button>
              </div>
              <div className="adm-quick-strip">
                {navigation.slice(1, 5).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className="button"
                    onClick={() => navigate(key)}
                  >
                    {label} ←
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="adm-grid-tables">
            <section className="panel adm-card">
              <div className="adm-card-head">
                <div>
                  <h2>أداء المطاعم</h2>
                  <p className="adm-card-sub">
                    {restTab === 'top'
                      ? 'الأعلى تحقيقاً للمبيعات المُسلّمة خلال الفترة'
                      : 'المطاعم الأعلى نسبة رفض للطلبات'}
                  </p>
                </div>
                <div
                  className="adm-seg adm-seg-sm"
                  role="group"
                  aria-label="تصنيف أداء المطاعم"
                >
                  <button
                    type="button"
                    className={restTab === 'top' ? 'active' : ''}
                    aria-pressed={restTab === 'top'}
                    onClick={() => setRestTab('top')}
                  >
                    الأعلى مبيعاً
                  </button>
                  <button
                    type="button"
                    className={restTab === 'attention' ? 'active' : ''}
                    aria-pressed={restTab === 'attention'}
                    onClick={() => setRestTab('attention')}
                  >
                    تحتاج متابعة
                  </button>
                </div>
              </div>

              {activeRestaurantsList.length === 0 ? (
                <div className="adm-chart-empty">
                  <p>
                    {restTab === 'top'
                      ? 'لا توجد طلبات مطاعم خلال الفترة المختارة.'
                      : 'ممتاز — لا توجد مطاعم مسجّلة برفض طلبات خلال هذه الفترة.'}
                  </p>
                </div>
              ) : (
                <ol className="adm-rank-list">
                  {activeRestaurantsList.map((rest, idx) => (
                    <li key={rest.rest_id} className="adm-rank-row">
                      <span
                        className={
                          'adm-rank-num numeric' +
                          (restTab === 'top' && idx === 0 ? ' is-top' : '')
                        }
                      >
                        {idx + 1}
                      </span>
                      <div className="adm-rank-main">
                        <span className="adm-rank-title">
                          {rest.rest_title}
                        </span>
                        <span className="adm-rank-sub numeric">
                          <span>
                            {rest.delivered_orders} مُسلّم من {rest.total_orders}{' '}
                            طلب
                          </span>
                          {rest.rejected_orders > 0 && (
                            <span
                              className={
                                'adm-mini-pill ' +
                                (rest.rejection_rate >= 15
                                  ? 'is-rose'
                                  : 'is-amber')
                              }
                            >
                              رفض {rest.rejection_rate}% ({rest.rejected_orders}
                              )
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="adm-rank-end numeric">
                        <strong>
                          <bdi>{money(rest.gmv)}</bdi>
                        </strong>
                        <small>#{rest.rest_id}</small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="panel adm-card">
              <div className="adm-card-head">
                <div>
                  <h2>الأصناف الأكثر طلباً</h2>
                  <p className="adm-card-sub">
                    الأعلى مبيعاً في الطلبات المُسلّمة عبر جميع المطاعم
                  </p>
                </div>
              </div>

              {data.top_items.length === 0 ? (
                <div className="adm-chart-empty">
                  <p>لا توجد مبيعات أصناف مُسلّمة خلال الفترة المختارة.</p>
                </div>
              ) : (
                <ol className="adm-rank-list">
                  {data.top_items.map((item, idx) => {
                    const widthPct = Math.max(
                      8,
                      Math.round(
                        ((Number(item.revenue) || 0) / maxItemRevenue) * 100,
                      ),
                    );
                    return (
                      <li
                        key={`${item.rest_id}-${item.item_name}`}
                        className="adm-rank-row"
                      >
                        <span
                          className={
                            'adm-rank-num numeric' +
                            (idx === 0 ? ' is-top' : '')
                          }
                        >
                          {idx + 1}
                        </span>
                        <div className="adm-rank-main">
                          <span className="adm-rank-title">
                            {item.item_name}
                          </span>
                          <span className="adm-rank-sub">
                            <span>{item.rest_title}</span>
                          </span>
                          <div className="adm-item-bar" aria-hidden="true">
                            <span style={{ width: `${widthPct}%` }} />
                          </div>
                        </div>
                        <div className="adm-rank-end numeric">
                          <strong>
                            <bdi>{money(item.revenue)}</bdi>
                          </strong>
                          <small>× {item.units_sold} وحدة</small>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
