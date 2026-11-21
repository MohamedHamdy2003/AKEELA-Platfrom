import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  Clock,
  Layers,
  Package,
  Receipt,
  RefreshCw,
  Repeat,
  ShoppingBag,
  Sparkles,
  SquarePlus,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type {
  AnalyticsRange,
  Profile,
  RestaurantAnalytics,
} from '../lib/models';
import { dateTime, money } from '../lib/format';
import { useResource } from '../lib/use-resource';
import { Failure } from '../components/ui';
import {
  RestaurantPeakHoursChart,
  RestaurantStatusDonut,
  RestaurantTrendChart,
} from './analytics-charts';
import './analytics.css';

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
  lowerIsBetter = false,
}: {
  current: number | null;
  previous: number | null;
  lowerIsBetter?: boolean;
}) {
  if (current === null || previous === null) return null;
  if (previous === 0) {
    if (current === 0) {
      return <span className="rst-delta is-flat numeric">0%</span>;
    }
    return (
      <span className={'rst-delta ' + (lowerIsBetter ? 'is-bad' : 'is-good')}>
        جديد
      </span>
    );
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10;
  if (pct === 0) return <span className="rst-delta is-flat numeric">0%</span>;
  const up = pct > 0;
  const good = lowerIsBetter ? !up : up;
  return (
    <span className={'rst-delta numeric ' + (good ? 'is-good' : 'is-bad')}>
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
      className="rst-analytics"
      aria-label="جارٍ تحميل تحليلات المطعم"
      aria-busy="true"
      role="status"
    >
      <div className="rst-sk-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="rst-sk-card" />
        ))}
      </div>
      <div className="rst-grid-primary">
        <div className="rst-sk-chart" />
        <div className="rst-sk-chart" />
      </div>
    </div>
  );
}

export function RestaurantAnalyticsScreen({
  profile,
  navigate,
}: {
  profile: Profile;
  navigate: (route: string) => void;
}) {
  const [range, setRange] = useState<AnalyticsRange>('30d');
  const [itemsTab, setItemsTab] = useState<'top' | 'slow'>('top');
  const [mixTab, setMixTab] = useState<'addons' | 'categories'>('addons');
  const analytics = useResource<RestaurantAnalytics>(
    `/restaurant/analytics?range=${range}`,
  );
  const [cached, setCached] = useState<RestaurantAnalytics | null>(null);

  useEffect(() => {
    if (analytics.result?.data) {
      setCached(analytics.result.data);
    }
  }, [analytics.result]);

  const data = analytics.result?.data ?? cached;
  const kpis = data?.kpis;
  const prev = data?.previous_kpis ?? null;
  const alerts = data?.live_alerts;
  const menu = data?.menu_totals;

  const hasAlerts =
    alerts &&
    alerts.pending_orders +
      alerts.stale_pending_orders +
      alerts.active_in_progress +
      alerts.expiring_offers +
      alerts.inactive_products >
      0;

  const maxAddonRev = Math.max(
    1,
    ...(data?.top_addons ?? []).map((a) => Number(a.revenue) || 0),
  );

  return (
    <div
      className="rst-analytics"
      data-refreshing={analytics.loading && Boolean(data)}
    >
      <section
        className="rst-hero"
        aria-label="تحليلات المطعم واختيار الفترة الزمنية"
      >
        <div className="rst-hero-brand">
          <div className="rst-hero-eyebrow">
            <span className="rst-hero-dot" aria-hidden="true" />
            <span>{profile.rest_title}</span>
          </div>
          <h1 className="rst-hero-title">تحليلات المطعم</h1>
          <p className="rst-hero-sub">
            مؤشرات المبيعات، جودة المطبخ، ولاء العملاء، وأداء أصناف المنيو
            بتوقيت القاهرة.
          </p>
        </div>

        <div className="rst-controls">
          <div
            className="rst-seg"
            role="group"
            aria-label="الفترة الزمنية لتحليلات المطعم"
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
          <button
            type="button"
            className={
              'rst-refresh-btn' + (analytics.loading ? ' spinning' : '')
            }
            aria-label="تحديث تحليلات المطعم"
            title={
              data
                ? `آخر تحديث: ${dateTime(data.generated_at)}`
                : 'تحديث التحليلات'
            }
            onClick={analytics.reload}
            disabled={analytics.loading}
          >
            <RefreshCw size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

      {Boolean(analytics.error) && (
        <Failure error={analytics.error} retry={analytics.reload} />
      )}

      {!data && analytics.loading && <AnalyticsSkeleton />}

      {data && kpis && alerts && menu && (
        <>
          <section className="rst-alerts" aria-label="تنبيهات المطبخ الحية">
            {hasAlerts ? (
              <>
                {alerts.stale_pending_orders > 0 && (
                  <button
                    type="button"
                    className="rst-alert-pill is-danger"
                    onClick={() => navigate('orders')}
                  >
                    <AlertTriangle size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.stale_pending_orders} طلب بانتظار قرارك لأكثر من
                      10 دقائق
                    </span>
                  </button>
                )}
                {alerts.pending_orders > 0 && (
                  <button
                    type="button"
                    className="rst-alert-pill is-warning"
                    onClick={() => navigate('orders')}
                  >
                    <Clock size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.pending_orders} طلب جديد بانتظار القبول
                    </span>
                  </button>
                )}
                {alerts.active_in_progress > 0 && (
                  <button
                    type="button"
                    className="rst-alert-pill is-info"
                    onClick={() => navigate('orders')}
                  >
                    <ShoppingBag size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.active_in_progress} طلب قيد التحضير والتوصيل الآن
                    </span>
                  </button>
                )}
                {alerts.expiring_offers > 0 && (
                  <button
                    type="button"
                    className="rst-alert-pill is-warning"
                    onClick={() => navigate('offers')}
                  >
                    <Tag size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.expiring_offers} عرض ينتهي خلال 48 ساعة
                    </span>
                  </button>
                )}
                {alerts.inactive_products > 0 && (
                  <button
                    type="button"
                    className="rst-alert-pill is-info"
                    onClick={() => navigate('products')}
                  >
                    <Package size={15} aria-hidden="true" />
                    <span className="numeric">
                      {alerts.inactive_products} منتج متوقف حالياً في المنيو
                    </span>
                  </button>
                )}
              </>
            ) : (
              <div className="rst-alert-pill is-ok" role="status">
                <CheckCircle2 size={15} aria-hidden="true" />
                <span>
                  المطبخ يعمل بسلاسة — لا توجد طلبات متأخرة أو تنبيهات عاجلة
                  الآن.
                </span>
              </div>
            )}
          </section>

          <section
            className="rst-kpi-grid"
            aria-label="المؤشرات التنفيذية للمطعم"
          >
            <article className="rst-kpi">
              <div className="rst-kpi-top">
                <span className="rst-kpi-label">
                  <span className="rst-kpi-ico is-emerald" aria-hidden="true">
                    <Banknote size={17} />
                  </span>
                  صافي مبيعات الطعام
                </span>
                <DeltaBadge
                  current={Number(kpis.food_revenue)}
                  previous={prev ? Number(prev.food_revenue) : null}
                />
              </div>
              <div className="rst-kpi-val numeric">
                <bdi>{money(kpis.food_revenue)}</bdi>
              </div>
              <div className="rst-kpi-foot numeric">
                إجمالي شامل التوصيل: <bdi>{money(kpis.gross_gmv)}</bdi>
              </div>
            </article>

            <article className="rst-kpi">
              <div className="rst-kpi-top">
                <span className="rst-kpi-label">
                  <span className="rst-kpi-ico is-orange" aria-hidden="true">
                    <Receipt size={17} />
                  </span>
                  متوسط قيمة الطلب (AOV)
                </span>
                <DeltaBadge
                  current={Number(kpis.avg_order_value)}
                  previous={prev ? Number(prev.avg_order_value) : null}
                />
              </div>
              <div className="rst-kpi-val numeric">
                <bdi>{money(kpis.avg_order_value)}</bdi>
              </div>
              <div className="rst-kpi-foot">متوسط قيمة الطعام لكل طلب مُسلّم</div>
            </article>

            <button
              type="button"
              className="rst-kpi"
              onClick={() => navigate('orders')}
            >
              <div className="rst-kpi-top">
                <span className="rst-kpi-label">
                  <span className="rst-kpi-ico is-emerald" aria-hidden="true">
                    <ShoppingBag size={17} />
                  </span>
                  الطلبات المُسلّمة
                </span>
                <DeltaBadge
                  current={kpis.delivered_orders}
                  previous={prev ? prev.delivered_orders : null}
                />
              </div>
              <div className="rst-kpi-val numeric">{kpis.delivered_orders}</div>
              <div className="rst-kpi-foot numeric">
                من إجمالي {kpis.total_orders} طلب · متابعة الطلبات ←
              </div>
            </button>

            <article className="rst-kpi">
              <div className="rst-kpi-top">
                <span className="rst-kpi-label">
                  <span className="rst-kpi-ico is-emerald" aria-hidden="true">
                    <CheckCircle2 size={17} />
                  </span>
                  نسبة القبول وجودة المطبخ
                </span>
              </div>
              <div className="rst-kpi-val numeric">
                <bdi>{kpis.acceptance_rate}%</bdi>
              </div>
              <div className="rst-bar" aria-hidden="true">
                <span
                  style={{
                    width: `${kpis.completion_rate}%`,
                    background: '#008657',
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
              </div>
              <div className="rst-kpi-foot numeric">
                إتمام {kpis.completion_rate}% · رفض {kpis.rejection_rate}% ·
                إلغاء {kpis.cancellation_rate}%
              </div>
            </article>

            <article className="rst-kpi">
              <div className="rst-kpi-top">
                <span className="rst-kpi-label">
                  <span className="rst-kpi-ico is-blue" aria-hidden="true">
                    <Repeat size={17} />
                  </span>
                  العملاء العائدون (الولاء)
                </span>
              </div>
              <div className="rst-kpi-val numeric">
                <bdi>{kpis.repeat_customer_rate}%</bdi>
              </div>
              <div className="rst-kpi-foot numeric">
                {kpis.repeat_customers} عميل متكرر من {kpis.unique_customers}{' '}
                عميل فريد
              </div>
            </article>

            <article className="rst-kpi">
              <div className="rst-kpi-top">
                <span className="rst-kpi-label">
                  <span className="rst-kpi-ico is-gold" aria-hidden="true">
                    <Sparkles size={17} />
                  </span>
                  عائد الإضافات الإضافي
                </span>
                <DeltaBadge
                  current={Number(kpis.addons_revenue)}
                  previous={prev ? Number(prev.addons_revenue) : null}
                />
              </div>
              <div className="rst-kpi-val numeric">
                <bdi>{money(kpis.addons_revenue)}</bdi>
              </div>
              <div className="rst-kpi-foot numeric">
                {kpis.avg_fulfillment_minutes !== null
                  ? `متوسط إتمام الطلب: ${kpis.avg_fulfillment_minutes} دقيقة`
                  : 'إيرادات الإضافات في الطلبات المُسلّمة'}
              </div>
            </article>
          </section>

          <div className="rst-grid-primary">
            <RestaurantTrendChart series={data.daily_series} />
            <RestaurantStatusDonut
              counts={data.status_breakdown}
              onSelectOrders={() => navigate('orders')}
            />
          </div>

          <div className="rst-grid-secondary">
            <RestaurantPeakHoursChart hours={data.peak_hours} />

            <section className="panel rst-card">
              <div className="rst-card-head">
                <div>
                  <h2>صحة المنيو والعروض</h2>
                  <p className="rst-card-sub">
                    ملخص العناصر المتاحة حالياً للعملاء في تطبيق أكيلة
                  </p>
                </div>
              </div>
              <div className="rst-menu-rows">
                <button
                  type="button"
                  className="rst-menu-row"
                  onClick={() => navigate('products')}
                >
                  <span className="rst-menu-title">
                    <Package size={16} aria-hidden="true" />
                    المنتجات والتصنيفات
                  </span>
                  <span className="rst-pills numeric">
                    <span className="rst-pill is-green">
                      {menu.active_products} منتج نشط
                    </span>
                    <span className="rst-pill">
                      {menu.active_categories} تصنيف
                    </span>
                    {menu.inactive_products > 0 && (
                      <span className="rst-pill is-amber">
                        {menu.inactive_products} متوقف
                      </span>
                    )}
                  </span>
                </button>

                <button
                  type="button"
                  className="rst-menu-row"
                  onClick={() => navigate('addons')}
                >
                  <span className="rst-menu-title">
                    <SquarePlus size={16} aria-hidden="true" />
                    الإضافات المفعّلة
                  </span>
                  <span className="rst-pills numeric">
                    <span className="rst-pill is-green">
                      {menu.active_addons} إضافة لزيادة السلة
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  className="rst-menu-row"
                  onClick={() => navigate('offers')}
                >
                  <span className="rst-menu-title">
                    <Tag size={16} aria-hidden="true" />
                    العروض الجارية الآن
                  </span>
                  <span className="rst-pills numeric">
                    <span className="rst-pill is-orange">
                      {menu.active_offers} عرض نشط
                    </span>
                  </span>
                </button>
              </div>
              <div className="rst-quick">
                <button
                  type="button"
                  className="button primary"
                  onClick={() => navigate('offers')}
                >
                  إنشاء عرض ترويجي
                </button>
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => navigate('products')}
                >
                  إدارة المنيو
                </button>
              </div>
            </section>
          </div>

          <div className="rst-grid-tables">
            <section className="panel rst-card">
              <div className="rst-card-head">
                <div>
                  <h2>أداء أصناف المنيو</h2>
                  <p className="rst-card-sub">
                    {itemsTab === 'top'
                      ? 'الأصناف والعروض الأعلى تحقيقاً للإيرادات خلال الفترة'
                      : 'أصناف نشطة ذات مبيعات منخفضة — فرصة لعمل عرض عليها'}
                  </p>
                </div>
                <div
                  className="rst-seg rst-seg-sm"
                  role="group"
                  aria-label="تصنيف أصناف المنيو"
                >
                  <button
                    type="button"
                    className={itemsTab === 'top' ? 'active' : ''}
                    aria-pressed={itemsTab === 'top'}
                    onClick={() => setItemsTab('top')}
                  >
                    الأكثر مبيعاً
                  </button>
                  <button
                    type="button"
                    className={itemsTab === 'slow' ? 'active' : ''}
                    aria-pressed={itemsTab === 'slow'}
                    onClick={() => setItemsTab('slow')}
                  >
                    تحتاج ترويج
                  </button>
                </div>
              </div>

              {itemsTab === 'top' ? (
                data.top_items.length === 0 ? (
                  <div className="rst-chart-empty">
                    <p>لا توجد مبيعات أصناف مُسلّمة خلال هذه الفترة.</p>
                  </div>
                ) : (
                  <ol className="rst-rank-list">
                    {data.top_items.map((item, idx) => (
                      <li
                        key={`${item.item_type}-${item.item_name}`}
                        className="rst-rank-row"
                      >
                        <span
                          className={
                            'rst-rank-num numeric' +
                            (idx === 0 ? ' is-top' : '')
                          }
                        >
                          {idx + 1}
                        </span>
                        <div className="rst-rank-main">
                          <span className="rst-rank-title">
                            {item.item_name}
                          </span>
                          <span className="rst-rank-sub numeric">
                            <span>× {item.units_sold} وحدة</span>
                            <span>{item.share_pct}% من الإيراد</span>
                            {item.item_type === 'offer' && (
                              <span className="rst-pill is-orange">عرض</span>
                            )}
                          </span>
                          <div className="rst-share-bar" aria-hidden="true">
                            <span
                              style={{
                                width: `${Math.max(8, Math.round(item.share_pct))}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div className="rst-rank-end numeric">
                          <strong>
                            <bdi>{money(item.revenue)}</bdi>
                          </strong>
                        </div>
                      </li>
                    ))}
                  </ol>
                )
              ) : data.slow_items.length === 0 ? (
                <div className="rst-chart-empty">
                  <p>لا توجد منتجات نشطة مسجلة في المنيو حالياً.</p>
                </div>
              ) : (
                <ol className="rst-rank-list">
                  {data.slow_items.map((item, idx) => (
                    <li key={item.prod_id} className="rst-rank-row">
                      <span className="rst-rank-num numeric">{idx + 1}</span>
                      <div className="rst-rank-main">
                        <span className="rst-rank-title">{item.prod_name}</span>
                        <span className="rst-rank-sub">
                          <span>{item.cat_title}</span>
                          <span className="rst-pill is-amber numeric">
                            {item.units_sold === 0
                              ? 'بدون مبيعات'
                              : `${item.units_sold} طلب فقط`}
                          </span>
                        </span>
                      </div>
                      <div className="rst-rank-end numeric">
                        <strong>
                          <bdi>{money(item.price)}</bdi>
                        </strong>
                        <small>سعر البيع</small>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <section className="panel rst-card">
              <div className="rst-card-head">
                <div>
                  <h2>الإضافات والتصنيفات</h2>
                  <p className="rst-card-sub">
                    {mixTab === 'addons'
                      ? 'أكثر الإضافات طلباً ومساهمة في رفع متوسط السلة'
                      : 'توزيع إيرادات المنيو حسب كل تصنيف'}
                  </p>
                </div>
                <div
                  className="rst-seg rst-seg-sm"
                  role="group"
                  aria-label="عرض الإضافات والتصنيفات"
                >
                  <button
                    type="button"
                    className={mixTab === 'addons' ? 'active' : ''}
                    aria-pressed={mixTab === 'addons'}
                    onClick={() => setMixTab('addons')}
                  >
                    أكثر الإضافات
                  </button>
                  <button
                    type="button"
                    className={mixTab === 'categories' ? 'active' : ''}
                    aria-pressed={mixTab === 'categories'}
                    onClick={() => setMixTab('categories')}
                  >
                    التصنيفات
                  </button>
                </div>
              </div>

              {mixTab === 'addons' ? (
                data.top_addons.length === 0 ? (
                  <div className="rst-chart-empty">
                    <p>لا توجد مبيعات إضافات خلال الفترة المختارة.</p>
                  </div>
                ) : (
                  <ol className="rst-rank-list">
                    {data.top_addons.map((addon, idx) => {
                      const pct = Math.max(
                        8,
                        Math.round(
                          ((Number(addon.revenue) || 0) / maxAddonRev) * 100,
                        ),
                      );
                      return (
                        <li key={addon.addon_name} className="rst-rank-row">
                          <span
                            className={
                              'rst-rank-num numeric' +
                              (idx === 0 ? ' is-top' : '')
                            }
                          >
                            {idx + 1}
                          </span>
                          <div className="rst-rank-main">
                            <span className="rst-rank-title">
                              {addon.addon_name}
                            </span>
                            <div className="rst-share-bar" aria-hidden="true">
                              <span
                                style={{
                                  width: `${pct}%`,
                                  background: '#cf480d',
                                }}
                              />
                            </div>
                          </div>
                          <div className="rst-rank-end numeric">
                            <strong>
                              <bdi>{money(addon.revenue)}</bdi>
                            </strong>
                            <small>× {addon.units_sold} وحدة</small>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )
              ) : data.category_breakdown.length === 0 ? (
                <div className="rst-chart-empty">
                  <p>لا توجد مبيعات مصنّفة خلال الفترة المختارة.</p>
                </div>
              ) : (
                <ol className="rst-rank-list">
                  {data.category_breakdown.map((cat, idx) => (
                    <li key={cat.cat_title} className="rst-rank-row">
                      <span
                        className={
                          'rst-rank-num numeric' + (idx === 0 ? ' is-top' : '')
                        }
                      >
                        {idx + 1}
                      </span>
                      <div className="rst-rank-main">
                        <span className="rst-rank-title">
                          <Layers size={13} aria-hidden="true" />{' '}
                          {cat.cat_title}
                        </span>
                        <span className="rst-rank-sub numeric">
                          <span>× {cat.units_sold} وحدة</span>
                          <span>{cat.share_pct}% من الإيراد</span>
                        </span>
                        <div className="rst-share-bar" aria-hidden="true">
                          <span
                            style={{
                              width: `${Math.max(8, Math.round(cat.share_pct))}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="rst-rank-end numeric">
                        <strong>
                          <bdi>{money(cat.revenue)}</bdi>
                        </strong>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
